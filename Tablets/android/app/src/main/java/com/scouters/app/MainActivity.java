package com.scouters.app;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final int PERMISSION_REQUEST_CODE = 123;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Request Permissions for Fire Tablet / Android
        requestAppPermissions();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();

        // 2. Crucial WebView Settings
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        
        // Required for some older Fire Tablets to handle JSON blobs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Use a custom WebViewClient to ensure bridge stays injected
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d("WebView", "Page finished loading: " + url);
            }
        });

        // 3. Handle Camera Permissions inside WebView
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Log.d("WebView", "OnPermissionRequest: " + request.getResources().toString());
                MainActivity.this.runOnUiThread(() -> {
                    // Grant all requested resources (Camera, etc)
                    request.grant(request.getResources());
                });
            }
        });

        // 4. Handle standard HTML5 Downloads
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimetype);
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "scout_export_" + System.currentTimeMillis() + ".json");

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(getApplicationContext(), "Downloading File...", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Log.e("Download", "Standard download failed: " + e.getMessage());
            }
        });

        // 5. The "Bridge" - This allows your JS to call Android.saveFile()
        webView.addJavascriptInterface(new WebAppInterface(), "Android");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/public/index.html");
    }

    // --- JavaScript Interface Class ---
    public class WebAppInterface {
        @JavascriptInterface
        public void saveFile(String filename, String content) {
            try {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) downloadsDir.mkdirs();
                
                File file = new File(downloadsDir, filename);
                FileOutputStream fOut = new FileOutputStream(file);
                OutputStreamWriter myOutWriter = new OutputStreamWriter(fOut);
                myOutWriter.write(content);
                myOutWriter.close();
                fOut.flush();
                fOut.close();

                MediaScannerConnection.scanFile(MainActivity.this, 
                    new String[]{file.getAbsolutePath()}, null, null);

                MainActivity.this.runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "✅ Saved to Downloads: " + filename, Toast.LENGTH_LONG).show()
                );
            } catch (Exception e) {
                Log.e("AndroidBridge", "Save failed: " + e.getMessage());
                MainActivity.this.runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "❌ Save Error: " + e.getMessage(), Toast.LENGTH_LONG).show()
                );
            }
        }
    }

    private void requestAppPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();
        permissionsNeeded.add(Manifest.permission.CAMERA);
        
        // Storage permissions are handled differently in API 33+ but let's keep it simple for FireOS 5
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        List<String> listPermissionsNeeded = new ArrayList<>();
        for (String perm : permissionsNeeded) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                listPermissionsNeeded.add(perm);
            }
        }
        
        if (!listPermissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, listPermissionsNeeded.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            for (int i = 0; i < permissions.length; i++) {
                if (grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    Log.d("Permissions", "Permission granted: " + permissions[i]);
                } else {
                    Log.e("Permissions", "Permission DENIED: " + permissions[i]);
                }
            }
        }
    }
}