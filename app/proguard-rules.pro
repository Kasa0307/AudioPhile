# Keep JavascriptInterface methods for Android MediaSession bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
