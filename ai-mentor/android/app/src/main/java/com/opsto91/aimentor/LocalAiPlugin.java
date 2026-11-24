package com.opsto91.aimentor;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Capacitor JS bridge ->
 * 1) LocalLlama JNI (in-app offline .gguf engine)
 * 2) Native OkHttp Cloud/Local API client (Gemini Native v1beta + OpenAI-compat + Anthropic)
 *    taaki WebView CORS ya endpoint mismatch se online AI kabhi fail na ho.
 */
@CapacitorPlugin(name = "LocalAi")
public class LocalAiPlugin extends Plugin {

    private static final MediaType JSON_MEDIA = MediaType.get("application/json; charset=utf-8");

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService transferWorker = Executors.newSingleThreadExecutor();
    private final ExecutorService netWorker = Executors.newCachedThreadPool();

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(25, TimeUnit.SECONDS)
            .writeTimeout(45, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build();

    private volatile Call activeCloudCall = null;

    @Override
    public void load() {
        LocalLlama.setAppContext(getContext());
    }

    private JSObject currentState() {
        List<String> models = LocalLlama.listModels(getContext());
        JSArray arr = new JSArray();
        for (String m : models) arr.put(m);
        JSObject o = new JSObject();
        o.put("models", arr);
        o.put("loaded", LocalLlama.loadedName != null ? LocalLlama.loadedName : "");
        o.put("status", LocalLlama.status);
        o.put("context", LocalLlama.options.context);
        o.put("threads", LocalLlama.options.threads);
        o.put("maxTokens", LocalLlama.options.maxTokens);
        o.put("temperature", (double) LocalLlama.options.temperature);
        return o;
    }

    private void emitStatus(String s) {
        JSObject d = new JSObject();
        d.put("status", s);
        notifyListeners("status", d);
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(currentState());
    }

    @PluginMethod
    public void listModels(PluginCall call) {
        call.resolve(currentState());
    }

    @PluginMethod
    public void saveOptions(PluginCall call) {
        int ctx = call.getInt("context", LocalLlama.options.context);
        int thr = call.getInt("threads", LocalLlama.options.threads);
        int tok = call.getInt("maxTokens", LocalLlama.options.maxTokens);
        double tmp = call.getDouble("temperature", (double) LocalLlama.options.temperature);
        LocalLlama.saveOptions(getContext(), ctx, thr, tok, (float) tmp);
        call.resolve(currentState());
    }

    @PluginMethod
    public void importModel(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "onPickGguf");
    }

    @ActivityCallback
    private void onPickGguf(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("File select nahi hui");
            return;
        }
        final Uri uri = result.getData().getData();
        transferWorker.execute(() -> {
            try {
                String name = LocalLlama.importModel(getContext(), uri, this::emitStatus);
                JSObject out = currentState();
                out.put("imported", name);
                call.resolve(out);
            } catch (Exception e) {
                emitStatus("Import failed: " + e.getMessage());
                call.reject(e.getMessage() != null ? e.getMessage() : "Import failed");
            }
        });
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        final String url = call.getString("url", "");
        if (url == null || url.isEmpty()) { call.reject("URL chahiye"); return; }
        transferWorker.execute(() -> {
            try {
                String name = LocalLlama.download(getContext(), url, this::emitStatus);
                JSObject out = currentState();
                out.put("downloaded", name);
                call.resolve(out);
            } catch (Exception e) {
                emitStatus("Download failed: " + e.getMessage());
                call.reject(e.getMessage() != null ? e.getMessage() : "Download failed");
            }
        });
    }

    @PluginMethod
    public void cancelTransfer(PluginCall call) {
        LocalLlama.cancelTransfer();
        call.resolve();
    }

    @PluginMethod
    public void loadModel(PluginCall call) {
        final String name = call.getString("name", "");
        if (name == null || name.isEmpty()) { call.reject("Model name chahiye"); return; }
        worker.execute(() -> {
            try {
                emitStatus("Loading " + name + "…");
                LocalLlama.select(getContext(), name);
                emitStatus(LocalLlama.status);
                call.resolve(currentState());
            } catch (Exception e) {
                emitStatus(LocalLlama.status);
                call.reject(e.getMessage() != null ? e.getMessage() : "Load failed");
            }
        });
    }

    @PluginMethod
    public void unloadModel(PluginCall call) {
        worker.execute(() -> {
            LocalLlama.unloadModel();
            emitStatus(LocalLlama.status);
            call.resolve(currentState());
        });
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        final String name = call.getString("name", "");
        worker.execute(() -> {
            try {
                LocalLlama.deleteModel(getContext(), name);
                call.resolve(currentState());
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Delete failed");
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        LocalLlama.cancelInference();
        Call c = activeCloudCall;
        if (c != null) c.cancel();
        call.resolve();
    }

    @PluginMethod
    public void generate(PluginCall call) {
        final String system = call.getString("system", "");
        final String user = call.getString("user", "");
        worker.execute(() -> {
            try {
                final long[] lastEmit = {0L};
                String full = LocalLlama.generate(system != null ? system : "", user != null ? user : "", text -> {
                    long now = android.os.SystemClock.uptimeMillis();
                    if (now - lastEmit[0] >= 100) {
                        lastEmit[0] = now;
                        JSObject ev = new JSObject();
                        ev.put("text", text);
                        notifyListeners("token", ev);
                    }
                });
                JSObject res = new JSObject();
                res.put("text", full);
                call.resolve(res);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Generation failed");
            }
        });
    }

    // =========================================================================
    // Native Cloud / Local HTTP Client (bypasses WebView CORS & supports Gemini)
    // =========================================================================

    private static boolean isGemini(String providerId, String baseUrl, String apiKey) {
        if ("gemini".equalsIgnoreCase(providerId)) return true;
        if (baseUrl != null && baseUrl.contains("generativelanguage.googleapis.com")) return true;
        return apiKey != null && apiKey.trim().startsWith("AIza");
    }

    private static String trimSlash(String s) {
        if (s == null) return "";
        String out = s.trim();
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out;
    }

    private static String extractErrorMsg(String body) {
        if (body == null || body.isEmpty()) return "Empty response";
        try {
            JSONObject j = new JSONObject(body);
            JSONObject err = j.optJSONObject("error");
            if (err != null) {
                String msg = err.optString("message", "");
                if (!msg.isEmpty()) return msg;
            }
        } catch (Exception ignored) {}
        return body.length() > 220 ? body.substring(0, 220) : body;
    }

    @PluginMethod
    public void fetchModels(PluginCall call) {
        final String providerId = call.getString("providerId", "");
        final String rawBase = call.getString("baseUrl", "");
        final String apiKey = call.getString("apiKey", "").trim();

        netWorker.execute(() -> {
            try {
                List<String> models = new ArrayList<>();
                if (isGemini(providerId, rawBase, apiKey)) {
                    if (apiKey.isEmpty()) {
                        throw new IOException("Pehle Google Gemini API key (AIza...) daalo");
                    }
                    String url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey + "&pageSize=100";
                    Request req = new Request.Builder().url(url).get().build();
                    try (Response r = httpClient.newCall(req).execute()) {
                        String body = r.body() != null ? r.body().string() : "";
                        if (!r.isSuccessful()) {
                            throw new IOException("Gemini HTTP " + r.code() + ": " + extractErrorMsg(body));
                        }
                        JSONArray arr = new JSONObject(body).optJSONArray("models");
                        if (arr != null) {
                            for (int i = 0; i < arr.length(); i++) {
                                JSONObject m = arr.getJSONObject(i);
                                JSONArray methods = m.optJSONArray("supportedGenerationMethods");
                                String mStr = methods != null ? methods.toString() : "";
                                if (mStr.contains("generateContent")) {
                                    String name = m.optString("name", "").replaceFirst("^models/", "");
                                    if (!name.isEmpty() && !name.contains("embedding") && !name.contains("aqa")) {
                                        models.add(name);
                                    }
                                }
                            }
                        }
                    }
                    Collections.sort(models, Collections.reverseOrder());
                } else {
                    String base = trimSlash(rawBase);
                    if (base.isEmpty()) {
                        if (apiKey.startsWith("gsk_")) base = "https://api.groq.com/openai/v1";
                        else if (apiKey.startsWith("sk-or-")) base = "https://openrouter.ai/api/v1";
                        else if (apiKey.startsWith("sk-")) base = "https://api.openai.com/v1";
                        else throw new IOException("Base URL khali hai");
                    }
                    Request.Builder rb = new Request.Builder().url(base + "/models").get();
                    if (!apiKey.isEmpty()) {
                        rb.header("Authorization", "Bearer " + apiKey);
                    }
                    try (Response r = httpClient.newCall(rb.build()).execute()) {
                        String body = r.body() != null ? r.body().string() : "";
                        if (!r.isSuccessful()) {
                            throw new IOException("HTTP " + r.code() + ": " + extractErrorMsg(body));
                        }
                        JSONObject root = new JSONObject(body);
                        JSONArray arr = root.optJSONArray("data");
                        if (arr == null) arr = root.optJSONArray("models");
                        if (arr != null) {
                            for (int i = 0; i < arr.length(); i++) {
                                JSONObject m = arr.getJSONObject(i);
                                String id = m.optString("id", m.optString("name", "")).replaceFirst("^models/", "");
                                if (!id.isEmpty()) models.add(id);
                            }
                        }
                    }
                    Collections.sort(models);
                }

                JSArray jsArr = new JSArray();
                for (String m : models) jsArr.put(m);
                JSObject out = new JSObject();
                out.put("models", jsArr);
                call.resolve(out);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Model scan failed");
            }
        });
    }

    @PluginMethod
    public void cloudChat(PluginCall call) {
        final String providerId = call.getString("providerId", "");
        final String rawBase = call.getString("baseUrl", "");
        final String apiKey = call.getString("apiKey", "").trim();
        final String rawModel = call.getString("model", "").trim();
        final String messagesJson = call.getString("messagesJson", "[]");

        netWorker.execute(() -> {
            try {
                JSONArray msgs = new JSONArray(messagesJson);
                String replyText;

                if (isGemini(providerId, rawBase, apiKey)) {
                    if (apiKey.isEmpty()) {
                        throw new IOException("Gemini API key khali hai — Settings (⚙) me key daalo.");
                    }
                    String model = rawModel.replaceFirst("^models/", "");
                    if (model.isEmpty()) model = "gemini-2.5-flash";
                    try {
                        replyText = executeGeminiNative(apiKey, model, msgs);
                    } catch (IOException ex) {
                        // Fallback if user had an older deprecated model name
                        if (!"gemini-2.5-flash".equals(model) && ex.getMessage() != null && ex.getMessage().contains("404")) {
                            replyText = executeGeminiNative(apiKey, "gemini-2.5-flash", msgs);
                        } else {
                            throw ex;
                        }
                    }
                } else {
                    String base = trimSlash(rawBase);
                    if (base.isEmpty()) {
                        if (apiKey.startsWith("gsk_")) base = "https://api.groq.com/openai/v1";
                        else if (apiKey.startsWith("sk-or-")) base = "https://openrouter.ai/api/v1";
                        else if (apiKey.startsWith("sk-")) base = "https://api.openai.com/v1";
                        else throw new IOException("Base URL khali hai — Settings (⚙) me URL daalo.");
                    }
                    String model = rawModel.isEmpty() ? "gpt-4o-mini" : rawModel;
                    replyText = executeOpenAiCompat(base, apiKey, model, msgs);
                }

                JSObject ev = new JSObject();
                ev.put("text", replyText);
                notifyListeners("token", ev);

                JSObject res = new JSObject();
                res.put("text", replyText);
                res.put("status", 200);
                call.resolve(res);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "API request failed");
            }
        });
    }

    private String executeGeminiNative(String apiKey, String model, JSONArray msgs) throws Exception {
        StringBuilder sysText = new StringBuilder();
        JSONArray contents = new JSONArray();

        for (int i = 0; i < msgs.length(); i++) {
            JSONObject m = msgs.getJSONObject(i);
            String role = m.optString("role", "user");
            String content = m.optString("content", "");
            if ("system".equals(role)) {
                if (sysText.length() > 0) sysText.append("\n\n");
                sysText.append(content);
            } else {
                String gRole = "assistant".equals(role) ? "model" : "user";
                JSONObject part = new JSONObject().put("text", content);
                JSONObject turn = new JSONObject()
                        .put("role", gRole)
                        .put("parts", new JSONArray().put(part));
                contents.put(turn);
            }
        }

        if (contents.length() == 0) {
            contents.put(new JSONObject()
                    .put("role", "user")
                    .put("parts", new JSONArray().put(new JSONObject().put("text", "hi"))));
        }

        JSONObject payload = new JSONObject();
        if (sysText.length() > 0) {
            payload.put("systemInstruction", new JSONObject()
                    .put("parts", new JSONArray().put(new JSONObject().put("text", sysText.toString()))));
        }
        payload.put("contents", contents);
        payload.put("generationConfig", new JSONObject()
                .put("temperature", 0.5)
                .put("maxOutputTokens", 2048));

        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
        Request req = new Request.Builder()
                .url(url)
                .post(RequestBody.create(payload.toString(), JSON_MEDIA))
                .build();

        Call call = httpClient.newCall(req);
        activeCloudCall = call;
        try (Response r = call.execute()) {
            String raw = r.body() != null ? r.body().string() : "";
            if (!r.isSuccessful()) {
                throw new IOException("Gemini HTTP " + r.code() + ": " + extractErrorMsg(raw));
            }
            JSONObject root = new JSONObject(raw);
            JSONArray candidates = root.optJSONArray("candidates");
            if (candidates == null || candidates.length() == 0) {
                throw new IOException("Gemini ne khali response diya");
            }
            JSONObject content = candidates.getJSONObject(0).optJSONObject("content");
            JSONArray parts = content != null ? content.optJSONArray("parts") : null;
            StringBuilder out = new StringBuilder();
            if (parts != null) {
                for (int i = 0; i < parts.length(); i++) {
                    JSONObject p = parts.getJSONObject(i);
                    if (!p.optBoolean("thought", false)) {
                        out.append(p.optString("text", ""));
                    }
                }
            }
            return out.toString().trim();
        } finally {
            activeCloudCall = null;
        }
    }

    private String executeOpenAiCompat(String base, String apiKey, String model, JSONArray msgs) throws Exception {
        JSONObject payload = new JSONObject()
                .put("model", model)
                .put("messages", msgs)
                .put("temperature", 0.5)
                .put("stream", false);

        Request.Builder rb = new Request.Builder()
                .url(base + "/chat/completions")
                .header("Content-Type", "application/json")
                .post(RequestBody.create(payload.toString(), JSON_MEDIA));
        if (!apiKey.isEmpty()) {
            rb.header("Authorization", "Bearer " + apiKey);
        }

        Call call = httpClient.newCall(rb.build());
        activeCloudCall = call;
        try (Response r = call.execute()) {
            String raw = r.body() != null ? r.body().string() : "";
            if (!r.isSuccessful()) {
                throw new IOException("HTTP " + r.code() + ": " + extractErrorMsg(raw));
            }
            JSONObject root = new JSONObject(raw);
            JSONArray choices = root.optJSONArray("choices");
            if (choices == null || choices.length() == 0) {
                throw new IOException("API ne khali choices diya");
            }
            JSONObject msg = choices.getJSONObject(0).optJSONObject("message");
            return msg != null ? msg.optString("content", "").trim() : "";
        } finally {
            activeCloudCall = null;
        }
    }
}
