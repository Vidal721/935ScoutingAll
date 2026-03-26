package com.scouters.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private ValueCallback<Uri[]> mFilePathCallback;
    private Uri mCameraImageUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Only request permissions if we are on Android 6.0+ (API 23)
        // Android 5.1 (API 22) grants all permissions at install time.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissionsNeeded = new ArrayList<>();
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.CAMERA);
            }
            if (!permissionsNeeded.isEmpty()) {
                ActivityCompat.requestPermissions(this, permissionsNeeded.toArray(new String[0]), 1002);
            }
        }

        WebView webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                mFilePathCallback = filePathCallback;
                Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                    startActivityForResult(takePictureIntent, FILE_CHOOSER_REQUEST);
                    return true;
                }
                return false;
            }
        });

        // Interface for your web app to call "Android.saveFile('test.json', '{...}')"
        webView.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void saveFile(String filename, String content) {
                try {
                    File file = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), filename);
                    FileWriter writer = new FileWriter(file);
                    writer.write(content);
                    writer.close();
                    MediaScannerConnection.scanFile(getApplicationContext(), new String[]{file.getAbsolutePath()}, null, null);
                } catch (Exception e) {
                    Log.e("SaveFile", "Error: " + e.getMessage());
                }
            }
        }, "Android");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/public/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST && mFilePathCallback != null) {
            Uri result = (data == null || resultCode != RESULT_OK) ? null : data.getData();
            mFilePathCallback.onReceiveValue(result != null ? new Uri[]{result} : null);
            mFilePathCallback = null;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
}
