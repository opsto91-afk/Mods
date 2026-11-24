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

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Capacitor JS bridge -> LocalLlama JNI.
 * Events emitted to JS: "token" ({ text }), "status" ({ status }).
 */
@CapacitorPlugin(name = "LocalAi")
public class LocalAiPlugin extends Plugin {

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService transferWorker = Executors.newSingleThreadExecutor();

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
                String name = LocalLlama.download(url, this::emitStatus);
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
                    if (now - lastEmit[0] >= 120) {
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
}
