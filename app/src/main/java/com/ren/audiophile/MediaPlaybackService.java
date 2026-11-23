package com.ren.audiophile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.LruCache;
import android.view.KeyEvent;

import androidx.annotation.NonNull;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native Android MediaSession + MediaStyle Foreground Service.
 * Provides:
 * - Rich lock-screen & notification shade media controls (Artwork, Title, Artist, Seekbar, Prev/Play-Pause/Next)
 * - Hardware Bluetooth & wired earphone button controls (Play/Pause, single/double/triple tap headset hook, Next, Previous)
 * - Automatic pause when earphones are unplugged or Bluetooth disconnects (ACTION_AUDIO_BECOMING_NOISY)
 */
public class MediaPlaybackService extends Service {
    public static final String ACTION_UPDATE_META = "com.ren.audiophile.ACTION_UPDATE_META";
    public static final String ACTION_UPDATE_STATE = "com.ren.audiophile.ACTION_UPDATE_STATE";
    public static final String ACTION_MEDIA_PREV = "com.ren.audiophile.ACTION_MEDIA_PREV";
    public static final String ACTION_MEDIA_TOGGLE = "com.ren.audiophile.ACTION_MEDIA_TOGGLE";
    public static final String ACTION_MEDIA_NEXT = "com.ren.audiophile.ACTION_MEDIA_NEXT";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ARTWORK = "artwork";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_POSITION = "position";

    private static final String CHANNEL_ID = "audiophile_media_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long HOOK_MULTI_TAP_MS = 350L;

    public interface CommandListener {
        void onCommand(String action, long valueMs);
    }

    private static volatile CommandListener commandListener;
    private static volatile MediaPlaybackService instance;

    public static void setCommandListener(CommandListener listener) {
        commandListener = listener;
    }

    public static MediaPlaybackService getInstance() {
        return instance;
    }

    public static void dispatchCommand(String action, long valueMs) {
        CommandListener listener = commandListener;
        if (listener != null) {
            listener.onCommand(action, valueMs);
        }
    }

    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();
    private final LruCache<String, Bitmap> artCache = new LruCache<>(12);

    private String currentTitle = "Audiophile";
    private String currentArtist = "Ready to play";
    private String currentArtworkUrl = "";
    private Bitmap currentBitmap = null;
    private long currentDurationMs = 0L;
    private long currentPositionMs = 0L;
    private boolean isPlaying = false;
    private boolean noisyRegistered = false;
    private boolean foregroundStarted = false;

    private int headsetTapCount = 0;
    private final Runnable headsetTapRunnable = () -> {
        int taps = headsetTapCount;
        headsetTapCount = 0;
        if (taps == 1) {
            dispatchCommand("toggle", 0);
        } else if (taps == 2) {
            dispatchCommand("next", 0);
        } else if (taps >= 3) {
            dispatchCommand("prev", 0);
        }
    };

    private final BroadcastReceiver noisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                // Pause automatically when Bluetooth or wired earphones disconnect.
                dispatchCommand("pause", 0);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Audiophile::MediaWakeLock");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
        }

        mediaSession = new MediaSession(this, "AudiophileMediaSession");
        mediaSession.setFlags(
                MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        Intent mediaButtonIntent = new Intent(Intent.ACTION_MEDIA_BUTTON);
        mediaButtonIntent.setClass(this, MediaPlaybackService.class);
        PendingIntent mediaPending = PendingIntent.getService(
                this,
                100,
                mediaButtonIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        mediaSession.setMediaButtonReceiver(mediaPending);

        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                dispatchCommand("play", 0);
            }

            @Override
            public void onPause() {
                dispatchCommand("pause", 0);
            }

            @Override
            public void onStop() {
                dispatchCommand("pause", 0);
            }

            @Override
            public void onSkipToNext() {
                dispatchCommand("next", 0);
            }

            @Override
            public void onSkipToPrevious() {
                dispatchCommand("prev", 0);
            }

            @Override
            public void onSeekTo(long pos) {
                currentPositionMs = Math.max(0L, pos);
                updateMediaSessionState();
                dispatchCommand("seek", currentPositionMs);
            }

            @Override
            public boolean onMediaButtonEvent(@NonNull Intent intent) {
                KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (event != null && handleKeyEvent(event)) {
                    return true;
                }
                return super.onMediaButtonEvent(intent);
            }
        });

        mediaSession.setActive(true);
        registerNoisyReceiver();
        updateMediaSessionMetadata();
        updateMediaSessionState();
    }

    private boolean handleKeyEvent(KeyEvent event) {
        if (event.getAction() != KeyEvent.ACTION_DOWN || event.getRepeatCount() > 0) {
            return false;
        }
        int code = event.getKeyCode();
        switch (code) {
            case KeyEvent.KEYCODE_HEADSETHOOK:
                headsetTapCount++;
                mainHandler.removeCallbacks(headsetTapRunnable);
                mainHandler.postDelayed(headsetTapRunnable, HOOK_MULTI_TAP_MS);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                dispatchCommand("toggle", 0);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                dispatchCommand("play", 0);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_STOP:
                dispatchCommand("pause", 0);
                return true;
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                dispatchCommand("next", 0);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                dispatchCommand("prev", 0);
                return true;
            default:
                return false;
        }
    }

    public void updateMetadataDirect(String title, String artist, String artwork, long duration) {
        mainHandler.post(() -> {
            if (title != null && !title.isEmpty()) currentTitle = title;
            if (artist != null && !artist.isEmpty()) currentArtist = artist;
            if (duration > 0) currentDurationMs = duration;

            if (artwork != null && !artwork.equals(currentArtworkUrl)) {
                currentArtworkUrl = artwork;
                loadArtworkAsync(artwork);
            }
            updateMediaSessionMetadata();
            updateMediaSessionState();
            refreshNotification();
        });
    }

    public void updateStateDirect(boolean playing, long position, long duration) {
        mainHandler.post(() -> {
            isPlaying = playing;
            currentPositionMs = Math.max(0L, position);
            if (duration > 0 && duration != currentDurationMs) {
                currentDurationMs = duration;
                updateMediaSessionMetadata();
            }
            updateMediaSessionState();
            refreshNotification();
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!foregroundStarted) {
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            foregroundStarted = true;
        }

        if (intent != null) {
            String action = intent.getAction();
            if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
                KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (event != null) {
                    handleKeyEvent(event);
                }
            } else if (ACTION_MEDIA_PREV.equals(action)) {
                dispatchCommand("prev", 0);
            } else if (ACTION_MEDIA_TOGGLE.equals(action)) {
                dispatchCommand("toggle", 0);
            } else if (ACTION_MEDIA_NEXT.equals(action)) {
                dispatchCommand("next", 0);
            } else if (ACTION_UPDATE_META.equals(action)) {
                updateMetadataDirect(
                        intent.getStringExtra(EXTRA_TITLE),
                        intent.getStringExtra(EXTRA_ARTIST),
                        intent.getStringExtra(EXTRA_ARTWORK),
                        intent.getLongExtra(EXTRA_DURATION, currentDurationMs)
                );
            } else if (ACTION_UPDATE_STATE.equals(action)) {
                updateStateDirect(
                        intent.getBooleanExtra(EXTRA_PLAYING, isPlaying),
                        intent.getLongExtra(EXTRA_POSITION, currentPositionMs),
                        intent.getLongExtra(EXTRA_DURATION, currentDurationMs)
                );
            }
        }
        return START_STICKY;
    }

    private void loadArtworkAsync(String url) {
        if (url == null || url.isEmpty()) {
            currentBitmap = null;
            refreshNotification();
            return;
        }
        Bitmap cached = artCache.get(url);
        if (cached != null) {
            currentBitmap = cached;
            updateMediaSessionMetadata();
            refreshNotification();
            return;
        }
        artworkExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setInstanceFollowRedirects(true);
                try (InputStream in = conn.getInputStream()) {
                    Bitmap bmp = BitmapFactory.decodeStream(in);
                    if (bmp != null) {
                        artCache.put(url, bmp);
                        mainHandler.post(() -> {
                            if (url.equals(currentArtworkUrl)) {
                                currentBitmap = bmp;
                                updateMediaSessionMetadata();
                                refreshNotification();
                            }
                        });
                    }
                }
            } catch (Exception ignored) {
                // Keep default icon if artwork download fails.
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void updateMediaSessionMetadata() {
        if (mediaSession == null) return;
        MediaMetadata.Builder meta = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, currentDurationMs > 0 ? currentDurationMs : -1L);
        if (currentBitmap != null) {
            meta.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, currentBitmap);
            meta.putBitmap(MediaMetadata.METADATA_KEY_ART, currentBitmap);
        }
        mediaSession.setMetadata(meta.build());
    }

    private void updateMediaSessionState() {
        if (mediaSession == null) return;
        long actions = PlaybackState.ACTION_PLAY
                | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_STOP
                | PlaybackState.ACTION_SKIP_TO_NEXT
                | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | PlaybackState.ACTION_SEEK_TO;

        int state = isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        PlaybackState playbackState = new PlaybackState.Builder()
                .setActions(actions)
                .setState(state, currentPositionMs, isPlaying ? 1.0f : 0.0f, SystemClock.elapsedRealtime())
                .build();
        mediaSession.setPlaybackState(playbackState);
    }

    private void refreshNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Action prevAction = new Notification.Action.Builder(
                R.drawable.ic_prev,
                "Previous",
                servicePendingIntent(ACTION_MEDIA_PREV, 1)
        ).build();

        Notification.Action toggleAction = new Notification.Action.Builder(
                isPlaying ? R.drawable.ic_pause : R.drawable.ic_play,
                isPlaying ? "Pause" : "Play",
                servicePendingIntent(ACTION_MEDIA_TOGGLE, 2)
        ).build();

        Notification.Action nextAction = new Notification.Action.Builder(
                R.drawable.ic_next,
                "Next",
                servicePendingIntent(ACTION_MEDIA_NEXT, 3)
        ).build();

        Notification.MediaStyle mediaStyle = new Notification.MediaStyle()
                .setMediaSession(mediaSession != null ? mediaSession.getSessionToken() : null)
                .setShowActionsInCompactView(0, 1, 2);

        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSmallIcon(R.drawable.ic_music_note)
                .setContentIntent(contentPending)
                .setStyle(mediaStyle)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setOngoing(isPlaying)
                .addAction(prevAction)
                .addAction(toggleAction)
                .addAction(nextAction);

        if (currentBitmap != null) {
            builder.setLargeIcon(currentBitmap);
        }
        return builder.build();
    }

    private PendingIntent servicePendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, MediaPlaybackService.class).setAction(action);
        return PendingIntent.getService(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void registerNoisyReceiver() {
        if (noisyRegistered) return;
        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(noisyReceiver, filter);
        }
        noisyRegistered = true;
    }

    @Override
    public void onDestroy() {
        instance = null;
        mainHandler.removeCallbacks(headsetTapRunnable);
        if (noisyRegistered) {
            try {
                unregisterReceiver(noisyReceiver);
            } catch (Exception ignored) {
            }
            noisyRegistered = false;
        }
        artworkExecutor.shutdownNow();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Audiophile Media Controls",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Lock screen and notification media player controls");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }
}
