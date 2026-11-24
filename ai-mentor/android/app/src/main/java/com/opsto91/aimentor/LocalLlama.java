package com.opsto91.aimentor;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * CPU-only GGUF runtime (llama.cpp JNI). ZaphRE ke LocalLlama ka port —
 * bina coroutines/okhttp ke, sirf JDK threads. Koi server ya API key nahi chahiye.
 */
public final class LocalLlama {

    // ---- JNI (local_llama.cpp) ----
    private native void init(String nativeLibDir);
    private native int load(String modelPath);
    private native int prepare(int contextSize, int threads, float temperature);
    private native void abortGeneration();
    private native void clearAbort();
    private native int processSystemPrompt(String systemPrompt);
    private native int processUserPrompt(String userPrompt, int predictLength);
    private native String generateNextToken();
    private native void unload();
    private native String lastError();

    public interface StatusCb { void onStatus(String s); }
    public interface TokenCb { void onUpdate(String fullSoFar); }

    public static volatile String status = "No model loaded";
    public static volatile String loadedName = null;
    private static volatile boolean cancelTransfer = false;
    private static String loadedPath = null;
    private static boolean initialized = false;

    public static final class Options {
        public int context = 4096;
        public int threads = 4;
        public int maxTokens = 512;
        public float temperature = 0.3f;
    }
    public static final Options options = new Options();

    private static final String[] STOP_MARKERS = {"\nUser:", "\nAssistant:", "\n<tool_result"};
    private static final byte[] GGUF_MAGIC = {0x47, 0x47, 0x55, 0x46}; // "GGUF"

    private LocalLlama() {}

    public static File folder(Context ctx) {
        File f = new File(ctx.getFilesDir(), "local-models");
        //noinspection ResultOfMethodCallIgnored
        f.mkdirs();
        return f;
    }

    public static List<String> listModels(Context ctx) {
        List<String> out = new ArrayList<>();
        File[] files = folder(ctx).listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isFile() && f.getName().toLowerCase(Locale.ROOT).endsWith(".gguf")) out.add(f.getName());
            }
        }
        out.sort(String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    public static void restoreOptions(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences("local_llama_options", Context.MODE_PRIVATE);
        options.context = clamp(p.getInt("context", 4096), 2048, 16384);
        options.threads = clamp(p.getInt("threads", 4), 1, 8);
        options.maxTokens = clamp(p.getInt("tokens", 512), 128, 2048);
        options.temperature = clampf(p.getFloat("temperature", 0.3f), 0f, 1.5f);
    }

    public static void saveOptions(Context ctx, int context, int threads, int maxTokens, float temperature) {
        options.context = clamp(context, 2048, 16384);
        options.threads = clamp(threads, 1, 8);
        options.maxTokens = clamp(maxTokens, 128, 2048);
        options.temperature = clampf(temperature, 0f, 1.5f);
        ctx.getSharedPreferences("local_llama_options", Context.MODE_PRIVATE).edit()
                .putInt("context", options.context)
                .putInt("threads", options.threads)
                .putInt("tokens", options.maxTokens)
                .putFloat("temperature", options.temperature)
                .apply();
        status = "Options saved — model reload karo to apply";
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }
    private static float clampf(float v, float lo, float hi) { return Math.max(lo, Math.min(hi, v)); }

    public static void cancelInference() {
        // abort flag atomic hai — kisi bhi thread se safe
        try { instance.abortGeneration(); } catch (Throwable ignored) {}
    }

    public static void cancelTransfer() { cancelTransfer = true; }

    private static volatile LocalLlama instance;

    /** class init pe ek baar load karo (sirf supported ABI pe) */
    private static LocalLlama ensure() {
        LocalLlama i = instance;
        if (i != null) return i;
        synchronized (LocalLlama.class) {
            if (instance == null) {
                LocalLlama n = new LocalLlama();
                System.loadLibrary("aimentor_llama");
                instance = n;
            }
            return instance;
        }
    }

    private static void checkGguf(File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            byte[] magic = new byte[4];
            if (in.read(magic) != 4 || !java.util.Arrays.equals(magic, GGUF_MAGIC)) {
                throw new IOException("Ye valid GGUF file nahi hai");
            }
        }
    }

    private static String safeName(String name) {
        String base = name.substring(name.lastIndexOf('/') + 1).replaceAll("[^a-zA-Z0-9._-]", "_");
        if (base.length() > 120) base = base.substring(0, 120);
        if (!base.toLowerCase(Locale.ROOT).endsWith(".gguf")) base += ".gguf";
        return base;
    }

    /** Content URI se app storage me copy (document picker) */
    public static String importModel(Context ctx, Uri uri, StatusCb cb) throws IOException {
        cancelTransfer = false;
        String display = null;
        try (android.database.Cursor c = ctx.getContentResolver().query(uri,
                new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) display = c.getString(0);
        } catch (Exception ignored) {}
        String base = safeName(display != null ? display : ("imported-" + System.currentTimeMillis() + ".gguf"));
        File root = folder(ctx);
        File file = new File(root, base);
        if (file.exists() || new File(file.getPath() + ".part").exists()) {
            String stem = base.substring(0, base.length() - 5);
            do {
                file = new File(root, stem + "-" + UUID.randomUUID().toString().substring(0, 8) + ".gguf");
            } while (file.exists() || new File(file.getPath() + ".part").exists());
        }
        File tmp = new File(file.getPath() + ".part");
        try {
            status = "Importing model…";
            if (cb != null) cb.onStatus(status);
            InputStream in = ctx.getContentResolver().openInputStream(uri);
            if (in == null) throw new IOException("File khali nahi khul sakti");
            try (InputStream input = in; FileOutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[128 * 1024];
                long count = 0, last = 0;
                while (true) {
                    if (cancelTransfer) throw new IOException("Import cancelled");
                    int n = input.read(buf);
                    if (n < 0) break;
                    out.write(buf, 0, n);
                    count += n;
                    if (count - last >= 4 * 1024 * 1024) {
                        status = "Importing: " + (count / 1048576) + " MB";
                        if (cb != null) cb.onStatus(status);
                        last = count;
                    }
                }
            }
            checkGguf(tmp);
            if (!tmp.renameTo(file)) throw new IOException("Model save nahi hua");
            status = "Imported " + file.getName();
            if (cb != null) cb.onStatus(status);
            return file.getName();
        } finally {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
        }
    }

    /** HTTPS se seedha GGUF download (curated catalogue) */
    public static String download(String urlStr, StatusCb cb) throws IOException {
        if (!urlStr.startsWith("https://")) throw new IOException("Sirf https URL chalega");
        cancelTransfer = false;
        String base = safeName(urlStr.substring(0, urlStr.indexOf('?') >= 0 ? urlStr.indexOf('?') : urlStr.length())
                .substring(urlStr.lastIndexOf('/') + 1));
        File root = folder(null, null);
        File target = new File(root, base);
        if (target.exists()) {
            status = "Model pehle se downloaded hai";
            if (cb != null) cb.onStatus(status);
            return base;
        }
        File part = new File(target.getPath() + ".part");
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(120000);
        conn.setInstanceFollowRedirects(true);
        conn.connect();
        int code = conn.getResponseCode();
        if (code / 100 != 3 && code != 200) throw new IOException("Download HTTP " + code);
        long total = conn.getContentLength();
        if (total > 0 && total > root.getUsableSpace()) {
            throw new IOException("Storage kam hai (" + (total / 1048576) + " MB chahiye)");
        }
        try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
            byte[] buf = new byte[128 * 1024];
            long count = 0, last = 0;
            int magicCount = 0;
            byte[] magic = new byte[4];
            while (true) {
                if (cancelTransfer) throw new IOException("Download cancelled");
                int n = in.read(buf);
                if (n < 0) break;
                if (magicCount < 4) {
                    int copied = Math.min(4 - magicCount, n);
                    System.arraycopy(buf, 0, magic, magicCount, copied);
                    magicCount += copied;
                    if (magicCount == 4 && !java.util.Arrays.equals(magic, GGUF_MAGIC)) {
                        throw new IOException("URL GGUF file nahi hai (model page/login link nahi)");
                    }
                }
                out.write(buf, 0, n);
                count += n;
                if (count - last >= 4 * 1024 * 1024) {
                    status = "Downloading: " + (count / 1048576) + " MB" +
                            (total > 0 ? " / " + (total / 1048576) + " MB" : "");
                    if (cb != null) cb.onStatus(status);
                    last = count;
                }
            }
        } finally {
            conn.disconnect();
        }
        checkGguf(part);
        if (!part.renameTo(target)) throw new IOException("Model save nahi hua");
        status = "Downloaded " + target.getName();
        if (cb != null) cb.onStatus(status);
        return target.getName();
    }

    /** folder(null,null) overload bachane ke liye — sirf listModels wala folder */
    private static File folder(Context a, Context b) {
        return folder(appCtx);
    }
    private static Context appCtx;

    public static void setAppContext(Context ctx) {
        appCtx = ctx.getApplicationContext();
        restoreOptions(appCtx);
    }

    /** GGUF load + context prepare */
    public static synchronized void select(Context ctx, String name) throws IOException {
        if (appCtx == null) setAppContext(ctx);
        File root = folder(ctx);
        File file = new File(root, name);
        if (!root.equals(file.getParentFile()) || !file.isFile()) throw new IOException("Model nahi mila: " + name);
        checkGguf(file);
        LocalLlama i = ensure();
        if (!initialized) {
            i.init(ctx.getApplicationInfo().nativeLibraryDir);
            initialized = true;
        }
        if (loadedPath != null) {
            i.unload();
            loadedPath = null;
            loadedName = null;
        }
        status = "Loading " + name + "…";
        if (i.load(file.getAbsolutePath()) != 0) {
            String why = safeErr(i.lastError());
            status = "Load failed";
            throw new IOException("Load nahi hua: " + name + (why.isEmpty() ? "" : " — " + why));
        }
        if (i.prepare(options.context, options.threads, options.temperature) != 0) {
            String why = safeErr(i.lastError());
            i.unload();
            status = "Context failed";
            throw new IOException("Context nahi bana" + (why.isEmpty() ? "" : " — " + why) +
                    " (chhota model/context try karo)");
        }
        loadedPath = file.getAbsolutePath();
        loadedName = name;
        status = "Ready: " + name + " (CPU)";
    }

    public static synchronized void unloadModel() {
        if (loadedPath != null) {
            try { ensure().unload(); } catch (Throwable ignored) {}
            loadedPath = null;
            loadedName = null;
        }
        status = "Model unloaded";
    }

    public static synchronized void deleteModel(Context ctx, String name) throws IOException {
        File root = folder(ctx);
        File file = new File(root, name);
        if (!root.equals(file.getParentFile()) || !file.isFile()) throw new IOException("Model nahi mila");
        if (file.getAbsolutePath().equals(loadedPath)) unloadModel();
        if (!file.delete()) throw new IOException("Delete nahi hua");
        status = "Deleted " + name;
    }

    private static String safeErr(String e) {
        if (e == null) return "";
        String t = e.trim();
        if (t.length() > 400) t = t.substring(t.length() - 400);
        return t;
    }

    /** system + user prompt → streaming tokens (TokenCb ko full-so-far milta hai) */
    public static String generate(String system, String user, TokenCb cb) throws IOException {
        LocalLlama i;
        synchronized (LocalLlama.class) {
            if (loadedPath == null) throw new IOException("Pehle Settings → Local GGUF me model Load karo");
            i = ensure();
        }
        i.clearAbort();
        int r1 = i.processSystemPrompt(system);
        if (r1 == 1) throw new IOException("System prompt context se bada — context badhao ya notes chhota karo");
        if (r1 != 0) throw new IOException("System prompt fail — model reload karo");
        int r2 = i.processUserPrompt(user, options.maxTokens);
        if (r2 == 1) throw new IOException("History context me fit nahi — nayi chat shuru karo ya context badhao");
        if (r2 != 0) throw new IOException("Prompt fail — model reload karo");
        StringBuilder result = new StringBuilder();
        while (true) {
            String next = i.generateNextToken();
            if (next == null) break;
            result.append(next);
            int cut = -1;
            for (String m : STOP_MARKERS) {
                int idx = result.indexOf(m);
                if (idx >= 0 && (cut < 0 || idx < cut)) cut = idx;
            }
            if (cut >= 0) {
                result.setLength(cut);
                if (cb != null) cb.onUpdate(result.toString());
                break;
            }
            if (cb != null) cb.onUpdate(result.toString());
        }
        return result.toString();
    }
}
