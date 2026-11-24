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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * CPU-only GGUF runtime (llama.cpp JNI). ZaphRE ke LocalLlama ka port —
 * OkHttp + single inference lock ke saath.
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

    private static final Object INFER_LOCK = new Object();

    public static volatile String status = "No model loaded";
    public static volatile String loadedName = null;
    private static volatile boolean cancelTransfer = false;
    private static volatile Call activeTransferCall = null;
    private static String loadedPath = null;
    private static boolean initialized = false;
    private static Context appCtx;

    public static final class Options {
        public int context = 4096;
        public int threads = 4;
        public int maxTokens = 512;
        public float temperature = 0.3f;
    }
    public static final Options options = new Options();

    private static final String[] STOP_MARKERS = {"\nUser:", "\nAssistant:", "\n<tool_result"};
    private static final byte[] GGUF_MAGIC = {0x47, 0x47, 0x55, 0x46}; // "GGUF"

    private static final OkHttpClient DL_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(180, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build();

    private LocalLlama() {}

    public static void setAppContext(Context ctx) {
        if (ctx != null) {
            appCtx = ctx.getApplicationContext();
            restoreOptions(appCtx);
        }
    }

    public static File folder(Context ctx) {
        Context c = ctx != null ? ctx : appCtx;
        File f = new File(c.getFilesDir(), "local-models");
        //noinspection ResultOfMethodCallIgnored
        f.mkdirs();
        return f;
    }

    public static List<String> listModels(Context ctx) {
        List<String> out = new ArrayList<>();
        File[] files = folder(ctx).listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isFile() && f.getName().toLowerCase(Locale.ROOT).endsWith(".gguf")) {
                    out.add(f.getName());
                }
            }
        }
        out.sort(String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    public static void restoreOptions(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences("local_llama_options", Context.MODE_PRIVATE);
        options.context = clamp(p.getInt("context", 4096), 2048, 16384);
        options.threads = clamp(p.getInt("threads", 4), 1, 8);
        options.maxTokens = clamp(p.getInt("tokens", 512), 128, 4096);
        options.temperature = clampf(p.getFloat("temperature", 0.3f), 0f, 1.5f);
    }

    public static void saveOptions(Context ctx, int context, int threads, int maxTokens, float temperature) {
        options.context = clamp(context, 2048, 16384);
        options.threads = clamp(threads, 1, 8);
        options.maxTokens = clamp(maxTokens, 128, 4096);
        options.temperature = clampf(temperature, 0f, 1.5f);
        ctx.getSharedPreferences("local_llama_options", Context.MODE_PRIVATE).edit()
                .putInt("context", options.context)
                .putInt("threads", options.threads)
                .putInt("tokens", options.maxTokens)
                .putFloat("temperature", options.temperature)
                .apply();
        status = loadedName != null
                ? "Ready: " + loadedName + " (options saved)"
                : "Options saved";
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }
    private static float clampf(float v, float lo, float hi) { return Math.max(lo, Math.min(hi, v)); }

    public static void cancelInference() {
        try {
            if (instance != null && initialized) instance.abortGeneration();
        } catch (Throwable ignored) {}
    }

    public static void cancelTransfer() {
        cancelTransfer = true;
        Call c = activeTransferCall;
        if (c != null) c.cancel();
    }

    private static volatile LocalLlama instance;

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

    /** Content URI se app storage me copy (document picker) + auto-load */
    public static String importModel(Context ctx, Uri uri, StatusCb cb) throws IOException {
        setAppContext(ctx);
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
            if (in == null) throw new IOException("Selected file open nahi ho saki");
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
            status = "Imported " + file.getName() + " — Loading…";
            if (cb != null) cb.onStatus(status);
            // Auto-load imported model so user can chat right away
            try {
                select(ctx, file.getName());
                if (cb != null) cb.onStatus(status);
            } catch (Exception loadEx) {
                status = "Imported " + file.getName() + " (Load error: " + loadEx.getMessage() + ")";
                if (cb != null) cb.onStatus(status);
            }
            return file.getName();
        } finally {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
        }
    }

    /** HTTPS se seedha GGUF download (OkHttp — redirects + resume check) + auto-load */
    public static String download(Context ctx, String urlStr, StatusCb cb) throws IOException {
        setAppContext(ctx);
        if (!urlStr.startsWith("https://")) throw new IOException("Sirf https URL chalega");
        cancelTransfer = false;
        String cleanUrl = urlStr.indexOf('?') >= 0 ? urlStr.substring(0, urlStr.indexOf('?')) : urlStr;
        String base = safeName(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1));
        File root = folder(ctx);
        File target = new File(root, base);
        if (target.exists()) {
            status = "Model pehle se downloaded hai — Loading…";
            if (cb != null) cb.onStatus(status);
            try { select(ctx, base); } catch (Exception ignored) {}
            if (cb != null) cb.onStatus(status);
            return base;
        }
        File part = new File(target.getPath() + ".part");
        Call call = DL_CLIENT.newCall(new Request.Builder()
                .url(urlStr)
                .header("User-Agent", "AIMentor-Android/1.0")
                .build());
        activeTransferCall = call;
        try (Response response = call.execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Download HTTP " + response.code());
            }
            ResponseBody body = response.body();
            if (body == null) throw new IOException("Empty download response");
            long total = body.contentLength();
            if (total > 0 && total > root.getUsableSpace()) {
                throw new IOException("Storage kam hai (" + (total / 1048576) + " MB chahiye)");
            }
            try (InputStream in = body.byteStream(); FileOutputStream out = new FileOutputStream(part)) {
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
                            throw new IOException("Download GGUF file nahi hai (direct .gguf link use karo)");
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
                if (total > 0 && part.length() != total) {
                    throw new IOException("Adhura download (" + (part.length() / 1048576) + "/" + (total / 1048576) + " MB)");
                }
            }
            checkGguf(part);
            if (!part.renameTo(target)) throw new IOException("Model save nahi hua");
            status = "Downloaded " + target.getName() + " — Loading…";
            if (cb != null) cb.onStatus(status);
            try {
                select(ctx, target.getName());
                if (cb != null) cb.onStatus(status);
            } catch (Exception loadEx) {
                status = "Downloaded " + target.getName() + " (Load error: " + loadEx.getMessage() + ")";
                if (cb != null) cb.onStatus(status);
            }
            return target.getName();
        } finally {
            activeTransferCall = null;
            //noinspection ResultOfMethodCallIgnored
            part.delete();
        }
    }

    /** GGUF load + context prepare */
    public static void select(Context ctx, String name) throws IOException {
        synchronized (INFER_LOCK) {
            setAppContext(ctx);
            File root = folder(ctx);
            File file = new File(root, name);
            if (!root.equals(file.getParentFile()) || !file.isFile()) {
                throw new IOException("Model nahi mila: " + name);
            }
            checkGguf(file);
            LocalLlama i = ensure();
            if (!initialized) {
                i.init(appCtx.getApplicationInfo().nativeLibraryDir);
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
                        " (Context 2048 try karo)");
            }
            loadedPath = file.getAbsolutePath();
            loadedName = name;
            status = "Ready: " + name + " (CPU)";
        }
    }

    public static void unloadModel() {
        synchronized (INFER_LOCK) {
            if (loadedPath != null) {
                try { ensure().unload(); } catch (Throwable ignored) {}
                loadedPath = null;
                loadedName = null;
            }
            status = "Model unloaded";
        }
    }

    public static void deleteModel(Context ctx, String name) throws IOException {
        synchronized (INFER_LOCK) {
            File root = folder(ctx);
            File file = new File(root, name);
            if (!root.equals(file.getParentFile()) || !file.isFile()) throw new IOException("Model nahi mila");
            if (file.getAbsolutePath().equals(loadedPath)) unloadModel();
            if (!file.delete()) throw new IOException("Delete nahi hua");
            status = "Deleted " + name;
        }
    }

    private static String safeErr(String e) {
        if (e == null) return "";
        String t = e.trim();
        if (t.length() > 400) t = t.substring(t.length() - 400);
        return t;
    }

    /** system + user prompt → streaming tokens */
    public static String generate(String system, String user, TokenCb cb) throws IOException {
        synchronized (INFER_LOCK) {
            if (loadedPath == null) {
                // Auto-load first available .gguf model if user didn't tap Load
                List<String> available = listModels(appCtx);
                if (!available.isEmpty()) {
                    select(appCtx, available.get(0));
                } else {
                    throw new IOException("Koi GGUF model nahi mila — Settings (⚙) me .gguf file Import ya Download karo.");
                }
            }
            LocalLlama i = ensure();
            i.clearAbort();

            String sys = system != null ? system : "";
            // Keep system prompt compact for small local GGUF context windows
            if (sys.length() > 1800) {
                sys = sys.substring(0, 1800);
            }
            int r1 = i.processSystemPrompt(sys);
            if (r1 == 1) {
                // Retry with ultra-short system prompt if context is tight
                r1 = i.processSystemPrompt("Tum ek helpful Hinglish AI mentor ho. Seedha aur saaf jawab do.");
            }
            if (r1 != 0) {
                throw new IOException("Local model system prompt fail — Settings me model reload karo");
            }

            String usr = user != null ? user.trim() : "";
            if (!usr.endsWith("Assistant:")) {
                usr = usr + "\nAssistant:";
            }
            int predict = Math.min(options.maxTokens, Math.max(128, options.context / 3));
            int r2 = i.processUserPrompt(usr, predict);
            if (r2 == 1 && usr.length() > 800) {
                // Trim older history so latest question fits
                usr = usr.substring(usr.length() - 800);
                r2 = i.processUserPrompt(usr, 256);
            }
            if (r2 != 0) {
                throw new IOException("Chat history context se badi hai — '+ New Chat' kholo ya Context badhao");
            }

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
            return result.toString().trim();
        }
    }
}
