package com.ren.audiophile;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.provider.Settings;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://ren-62c.pages.dev/home";
    private static final String APP_HOST = "ren-62c.pages.dev";
    private static final int REQ_POST_NOTIFICATIONS = 42;

    private AudiophileWebView webView;
    private LinearLayout offlineView;
    private int topCutoutDp = 0;
    private boolean pageLoaded = false;
    private long lastBackPressMs = 0L;
    private final ExecutorService updaterExecutor = Executors.newSingleThreadExecutor();
    private volatile boolean isDownloadingUpdate = false;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#07090F"));

        webView = new AudiophileWebView(this);
        webView.setBackgroundColor(Color.parseColor("#07090F"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        // Block native browser long-press text selection, blue highlight handles, and link popups.
        webView.setLongClickable(false);
        webView.setOnLongClickListener(v -> true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Register native JavaScript bridge for MediaSession notifications & earphone controls.
        webView.addJavascriptInterface(new AudiophileJsBridge(), "AudiophileNative");

        MediaPlaybackService.setCommandListener((action, valueMs) -> runOnUiThread(() -> {
            if (webView != null) {
                String js = "window.__audiophileMediaAction && window.__audiophileMediaAction('"
                        + action + "'," + valueMs + ");";
                webView.evaluateJavascript(js, null);
            }
        }));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // Serve bundled app assets locally from APK assets/public/ for instant offline UI & WASM load,
                // while letting /api/proxy* pass through to the backend as same-origin.
                if (!"GET".equalsIgnoreCase(request.getMethod())) {
                    return null;
                }
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host == null || !host.equalsIgnoreCase(APP_HOST)) {
                    return null;
                }
                String path = uri.getPath();
                if (path == null || path.startsWith("/api/")) {
                    return null;
                }
                return serveBundledAsset(path);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && host.equalsIgnoreCase(APP_HOST)) {
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pageLoaded = true;
                applySafeTopCss();
                offlineView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    webView.setVisibility(View.GONE);
                    offlineView.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView.HitTestResult result = view.getHitTestResult();
                String data = result != null ? result.getExtra() : null;
                if (data != null && !data.isEmpty()) {
                    openExternal(Uri.parse(data));
                    return false;
                }

                WebView tempWebView = new WebView(MainActivity.this);
                tempWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                        Uri uri = req.getUrl();
                        String host = uri.getHost();
                        if (host != null && host.equalsIgnoreCase(APP_HOST)) {
                            webView.loadUrl(uri.toString());
                        } else {
                            openExternal(uri);
                        }
                        v.destroy();
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(tempWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        offlineView = buildOfflineView();
        offlineView.setVisibility(View.GONE);

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        root.addView(offlineView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideStatusBar();

        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets cutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets navAndIme = windowInsets.getInsets(
                    WindowInsetsCompat.Type.navigationBars() | WindowInsetsCompat.Type.ime()
            );
            float density = getResources().getDisplayMetrics().density;
            topCutoutDp = density > 0 ? Math.round(cutout.top / density) : 0;
            if (pageLoaded) {
                applySafeTopCss();
            }
            view.setPadding(
                    Math.max(cutout.left, navAndIme.left),
                    0,
                    Math.max(cutout.right, navAndIme.right),
                    navAndIme.bottom
            );
            return WindowInsetsCompat.CONSUMED;
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && pageLoaded) {
                    webView.evaluateJavascript(
                            "(function(){ return window.__audiophileHandleBack ? window.__audiophileHandleBack() : 'fallback'; })()",
                            result -> {
                                String res = result != null ? result.replace("\"", "").trim() : "";
                                if ("handled".equals(res)) {
                                    lastBackPressMs = 0L;
                                    return;
                                }
                                if ("fallback".equals(res) && webView.canGoBack()) {
                                    webView.goBack();
                                    return;
                                }
                                long now = System.currentTimeMillis();
                                if (now - lastBackPressMs <= 2000L) {
                                    lastBackPressMs = 0L;
                                    moveTaskToBack(true);
                                } else {
                                    lastBackPressMs = now;
                                    webView.evaluateJavascript(
                                            "window.__audiophileShowExitHint && window.__audiophileShowExitHint();",
                                            null
                                    );
                                }
                            }
                    );
                    return;
                }
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });

        ensureMediaServiceStarted();

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    /**
     * Also catch hardware Bluetooth/earphone media keys when MainActivity has window focus.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            switch (event.getKeyCode()) {
                case KeyEvent.KEYCODE_HEADSETHOOK:
                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                    MediaPlaybackService.dispatchCommand("toggle", 0);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_PLAY:
                    MediaPlaybackService.dispatchCommand("play", 0);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_PAUSE:
                case KeyEvent.KEYCODE_MEDIA_STOP:
                    MediaPlaybackService.dispatchCommand("pause", 0);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_NEXT:
                    MediaPlaybackService.dispatchCommand("next", 0);
                    return true;
                case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                    MediaPlaybackService.dispatchCommand("prev", 0);
                    return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private WebResourceResponse serveBundledAsset(String rawPath) {
        try {
            String clean = rawPath.startsWith("/") ? rawPath.substring(1) : rawPath;
            if (clean.isEmpty() || !clean.contains(".")) {
                clean = "index.html";
            }
            InputStream stream = getAssets().open("public/" + clean);
            String mime = mimeTypeFor(clean);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream);
        } catch (Exception e) {
            // If a deep SPA route failed asset lookup, serve index.html from APK assets.
            try {
                InputStream fallback = getAssets().open("public/index.html");
                Map<String, String> headers = new HashMap<>();
                headers.put("Access-Control-Allow-Origin", "*");
                return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, fallback);
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private static String mimeTypeFor(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".wasm")) return "application/wasm";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private void applySafeTopCss() {
        int safeTop = Math.max(topCutoutDp, 0);
        int barHeight = 52 + safeTop;
        String js = "(function(){" +
                "document.documentElement.style.setProperty('--android-safe-top','" + safeTop + "px');" +
                "var s=document.getElementById('audiophile-android-safe');" +
                "if(!s){s=document.createElement('style');s.id='audiophile-android-safe';document.head.appendChild(s);}" +
                "s.textContent='" +
                "header[aria-label=\"Main\"]{min-height:" + barHeight + "px !important;padding-top:" + safeTop + "px !important;}" +
                "section[aria-label=\"Player\"]{padding-top:" + (safeTop + 12) + "px !important;}" +
                "';" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    private void hideStatusBar() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                            ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                            : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller == null) return;
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        controller.hide(WindowInsetsCompat.Type.statusBars());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideStatusBar();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideStatusBar();
        webView.onResume();
        webView.resumeTimers();
    }

    @Override
    protected void onDestroy() {
        updaterExecutor.shutdownNow();
        MediaPlaybackService.setCommandListener(null);
        stopService(new Intent(this, MediaPlaybackService.class));
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private void ensureMediaServiceStarted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQ_POST_NOTIFICATIONS
            );
            return;
        }
        startMediaService();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_POST_NOTIFICATIONS) {
            startMediaService();
        }
    }

    private void startMediaService() {
        Intent serviceIntent = new Intent(this, MediaPlaybackService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void openExternal(Uri uri) {
        try {
            CustomTabColorSchemeParams colors = new CustomTabColorSchemeParams.Builder()
                    .setToolbarColor(Color.parseColor("#070B14"))
                    .build();
            CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                    .setDefaultColorSchemeParams(colors)
                    .setShowTitle(false)
                    .build();
            customTabsIntent.launchUrl(this, uri);
        } catch (Exception ignored) {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        }
    }

    private LinearLayout buildOfflineView() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#070B14"));
        int pad = Math.round(32 * getResources().getDisplayMetrics().density);
        layout.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText(R.string.offline_title);
        title.setTextColor(Color.WHITE);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);

        TextView subtitle = new TextView(this);
        subtitle.setText(R.string.offline_subtitle);
        subtitle.setTextColor(Color.parseColor("#9BB1E0"));
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, pad / 4, 0, pad / 2);

        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v -> {
            offlineView.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            webView.loadUrl(APP_URL);
        });

        layout.addView(title);
        layout.addView(subtitle);
        layout.addView(retry);
        return layout;
    }

    private void emitUpdateProgress(int percent, String status, String message) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String safeMsg = JSONObject.quote(message != null ? message : "");
            String safeStatus = JSONObject.quote(status != null ? status : "");
            String js = "window.__audiophileUpdateProgress && window.__audiophileUpdateProgress("
                    + percent + "," + safeStatus + "," + safeMsg + ");";
            webView.evaluateJavascript(js, null);
        });
    }

    private void emitUpdateManifest(String rawJson, String error) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String argJson = rawJson != null ? JSONObject.quote(rawJson) : "null";
            String argErr = error != null ? JSONObject.quote(error) : "null";
            String js = "window.__audiophileUpdateManifest && window.__audiophileUpdateManifest("
                    + argJson + "," + argErr + ");";
            webView.evaluateJavascript(js, null);
        });
    }

    private HttpURLConnection openWithRedirects(String rawUrl) throws Exception {
        String current = rawUrl;
        for (int hops = 0; hops < 6; hops++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "Audiophile-Android");
            conn.setRequestProperty("Cache-Control", "no-cache");
            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM
                    || code == HttpURLConnection.HTTP_MOVED_TEMP
                    || code == HttpURLConnection.HTTP_SEE_OTHER
                    || code == 307
                    || code == 308) {
                String loc = conn.getHeaderField("Location");
                conn.disconnect();
                if (loc == null || loc.isEmpty()) {
                    throw new Exception("Redirect missing Location header");
                }
                current = new URL(new URL(current), loc).toString();
                continue;
            }
            return conn;
        }
        throw new Exception("Too many redirects");
    }

    private void launchApkInstaller(File apkFile) {
        runOnUiThread(() -> {
            try {
                Uri contentUri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        apkFile
                );
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                emitUpdateProgress(0, "error", "Installer failed: " + e.getMessage());
            }
        });
    }

    /**
     * JavaScript -> Native Android bridge called by src/state/player.ts whenever
     * track metadata or playback state changes.
     */
    private final class AudiophileJsBridge {
        @JavascriptInterface
        public void updateMetadata(String title, String artist, String artworkUrl, long durationMs) {
            MediaPlaybackService service = MediaPlaybackService.getInstance();
            if (service != null) {
                service.updateMetadataDirect(
                        title != null ? title : "",
                        artist != null ? artist : "",
                        artworkUrl != null ? artworkUrl : "",
                        durationMs
                );
                return;
            }
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class)
                    .setAction(MediaPlaybackService.ACTION_UPDATE_META)
                    .putExtra(MediaPlaybackService.EXTRA_TITLE, title != null ? title : "")
                    .putExtra(MediaPlaybackService.EXTRA_ARTIST, artist != null ? artist : "")
                    .putExtra(MediaPlaybackService.EXTRA_ARTWORK, artworkUrl != null ? artworkUrl : "")
                    .putExtra(MediaPlaybackService.EXTRA_DURATION, durationMs);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(MainActivity.this, intent);
                } else {
                    startService(intent);
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void updatePlaybackState(boolean playing, long positionMs, long durationMs) {
            MediaPlaybackService service = MediaPlaybackService.getInstance();
            if (service != null) {
                service.updateStateDirect(playing, positionMs, durationMs);
                return;
            }
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class)
                    .setAction(MediaPlaybackService.ACTION_UPDATE_STATE)
                    .putExtra(MediaPlaybackService.EXTRA_PLAYING, playing)
                    .putExtra(MediaPlaybackService.EXTRA_POSITION, positionMs)
                    .putExtra(MediaPlaybackService.EXTRA_DURATION, durationMs);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(MainActivity.this, intent);
                } else {
                    startService(intent);
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void haptic(String style) {
            runOnUiThread(() -> {
                if (webView == null) return;
                int feedback = HapticFeedbackConstants.CLOCK_TICK;
                if ("medium".equals(style) || "confirm".equals(style)) {
                    feedback = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            ? HapticFeedbackConstants.CONTEXT_CLICK
                            : HapticFeedbackConstants.KEYBOARD_TAP;
                } else if ("heavy".equals(style)) {
                    feedback = HapticFeedbackConstants.LONG_PRESS;
                }
                webView.performHapticFeedback(feedback);
            });
        }

        @JavascriptInterface
        public int getAppVersionCode() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    return (int) info.getLongVersionCode();
                }
                return info.versionCode;
            } catch (Exception e) {
                return 1;
            }
        }

        @JavascriptInterface
        public String getAppVersionName() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                return info.versionName != null ? info.versionName : "1.0.0";
            } catch (Exception e) {
                return "1.0.0";
            }
        }

        @JavascriptInterface
        public boolean canInstallPackages() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                return getPackageManager().canRequestPackageInstalls();
            }
            return true;
        }

        @JavascriptInterface
        public void openInstallPermissionSettings() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        Intent intent = new Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getPackageName())
                        );
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void fetchUpdateManifest(String manifestUrl) {
            if (manifestUrl == null || manifestUrl.trim().isEmpty()) {
                emitUpdateManifest(null, "Missing update manifest URL");
                return;
            }
            updaterExecutor.execute(() -> {
                HttpURLConnection conn = null;
                try {
                    conn = openWithRedirects(manifestUrl.trim());
                    int code = conn.getResponseCode();
                    if (code < 200 || code >= 300) {
                        emitUpdateManifest(null, "HTTP " + code);
                        return;
                    }
                    try (InputStream in = new BufferedInputStream(conn.getInputStream());
                         ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            out.write(buf, 0, n);
                        }
                        emitUpdateManifest(out.toString(StandardCharsets.UTF_8.name()), null);
                    }
                } catch (Exception e) {
                    emitUpdateManifest(null, e.getMessage() != null ? e.getMessage() : "Network error");
                } finally {
                    if (conn != null) conn.disconnect();
                }
            });
        }

        @JavascriptInterface
        public void downloadAndInstallUpdate(String apkUrl) {
            if (apkUrl == null || apkUrl.trim().isEmpty()) {
                emitUpdateProgress(0, "error", "Invalid APK URL");
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
                emitUpdateProgress(0, "permission_needed", "Enable 'Install unknown apps' for Audiophile, then tap Update again.");
                openInstallPermissionSettings();
                return;
            }
            if (isDownloadingUpdate) return;
            isDownloadingUpdate = true;
            emitUpdateProgress(0, "downloading", "Connecting…");

            updaterExecutor.execute(() -> {
                HttpURLConnection conn = null;
                try {
                    conn = openWithRedirects(apkUrl.trim());
                    int code = conn.getResponseCode();
                    if (code < 200 || code >= 300) {
                        emitUpdateProgress(0, "error", "Download failed (HTTP " + code + ")");
                        return;
                    }
                    long totalBytes = conn.getContentLengthLong();
                    File updatesDir = new File(getCacheDir(), "updates");
                    if (!updatesDir.exists()) {
                        updatesDir.mkdirs();
                    }
                    File apkFile = new File(updatesDir, "audiophile-update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }

                    try (InputStream in = new BufferedInputStream(conn.getInputStream());
                         FileOutputStream fos = new FileOutputStream(apkFile)) {
                        byte[] buffer = new byte[16384];
                        long downloaded = 0;
                        int lastPct = -1;
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            fos.write(buffer, 0, read);
                            downloaded += read;
                            if (totalBytes > 0) {
                                int pct = (int) Math.min(100, (downloaded * 100L) / totalBytes);
                                if (pct != lastPct) {
                                    lastPct = pct;
                                    String mb = String.format(java.util.Locale.US, "%.1f / %.1f MB",
                                            downloaded / (1024.0 * 1024.0), totalBytes / (1024.0 * 1024.0));
                                    emitUpdateProgress(pct, "downloading", mb);
                                }
                            } else {
                                String mb = String.format(java.util.Locale.US, "%.1f MB downloaded",
                                        downloaded / (1024.0 * 1024.0));
                                emitUpdateProgress(50, "downloading", mb);
                            }
                        }
                        fos.flush();
                    }

                    emitUpdateProgress(100, "installing", "Opening Android installer…");
                    launchApkInstaller(apkFile);
                } catch (Exception e) {
                    emitUpdateProgress(0, "error", e.getMessage() != null ? e.getMessage() : "Download failed");
                } finally {
                    isDownloadingUpdate = false;
                    if (conn != null) conn.disconnect();
                }
            });
        }
    }

    private static final class AudiophileWebView extends WebView {
        AudiophileWebView(Context context) {
            super(context);
        }

        @Override
        protected void onWindowVisibilityChanged(int visibility) {
            if (visibility != View.GONE) {
                super.onWindowVisibilityChanged(View.VISIBLE);
            } else {
                super.onWindowVisibilityChanged(visibility);
            }
        }
    }
}
