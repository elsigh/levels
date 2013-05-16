

package com.phonedied.android;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.AsyncTask;
import android.os.BatteryManager;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

//import com.mixpanel.android.mpmetrics.MixpanelAPI;

import org.apache.http.client.ClientProtocolException;
import org.apache.http.client.ResponseHandler;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.HttpResponse;
import org.apache.http.impl.client.BasicResponseHandler;
import org.apache.http.impl.client.DefaultHttpClient;

import org.json.JSONObject;
import org.json.JSONException;

import java.io.IOException;

import com.phonedied.android.PhoneDiedService;


public class PhoneDiedAlarm extends BroadcastReceiver {

    private static final String TAG = PhoneDiedAlarm.class.getSimpleName();

    public static final String PREFS_NAME = "PhoneDiedPrefs";

    private String updatePath = "";
    private String apiToken = "";
    private String userId = "";
    private String deviceId = "";
    private String updateFrequency = "";

    public static HttpResponse makeRequest(String updatePath, JSONObject json) throws Exception {
        Log.d(TAG, "makeRequest: " + updatePath + ", " + json.toString());
        //instantiates httpClient to make request
        DefaultHttpClient httpClient = new DefaultHttpClient();

        //url with the post data
        HttpPost httpPost = new HttpPost(updatePath);

        //httpPost.setHeader("User-Agent", "Android");

        //passes the results to a string builder/entity
        StringEntity se = new StringEntity(json.toString());
        httpPost.setEntity(se);

        //sets a request header so the page receving the request
        //will know what to do with it
        httpPost.setHeader("Accept", "application/json");
        httpPost.setHeader("Content-type", "application/json");

        //Handles what is returned from the page
        //ResponseHandler responseHandler = new BasicResponseHandler();
        return httpClient.execute(httpPost);
    }

    private boolean isAirplaneModeOn(ContentResolver contentResolver) {
        return Settings.System.getInt(contentResolver, Settings.System.AIRPLANE_MODE_ON, 0) == 1;
        /*
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
           return Settings.System.getInt(contentResolver, Settings.System.AIRPLANE_MODE_ON, 0) == 1;
        } else {
           return Settings.Global.getInt(contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) == 1;
        }
        */
    }

    private boolean isBluetoothOn(ContentResolver contentResolver) {
        return Settings.System.getInt(contentResolver, Settings.System.BLUETOOTH_ON, 0) == 1;
        /*
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
           return Settings.System.getInt(contentResolver, Settings.System.BLUETOOTH_ON, 0) == 1;
        } else {
           return Settings.Global.getInt(contentResolver, Settings.Global.BLUETOOTH_ON, 0) == 1;
        }
        */
    }

    private int getRingerModeInt(ContentResolver contentResolver) {
        return Settings.System.getInt(contentResolver, Settings.System.MODE_RINGER, 0);
        /*
        Log.d(TAG, android.os.Build.VERSION.SDK_INT + " vs:: " +
              android.os.Build.VERSION_CODES.JELLY_BEAN);
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
            Log.d(TAG, "SYSTEM STYLEZZZZZZ");
           return Settings.System.getInt(contentResolver, Settings.System.MODE_RINGER, 0);
        } else {
           return Settings.Global.getInt(contentResolver, Settings.Global.MODE_RINGER, 0);
        }
        */
    }

    public void SendBatteryStatus(Context context,
                                  String apiToken, String userId, String deviceId,
                                  String updatePath) {
        Log.d(TAG, "SendBatteryStatus: " + apiToken + ", " + userId + ", " +
              deviceId + ", " + updatePath);

        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        ConnectivityManager connManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "");
        wl.acquire();

        IntentFilter batIntentFilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent batteryIntent = context.getApplicationContext().
                registerReceiver(null, batIntentFilter);

        int status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                             status == BatteryManager.BATTERY_STATUS_FULL;
        int isChargingInt = isCharging ? 1 : 0;

        //int chargePlug = batteryIntent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1);
        //boolean usbCharge = chargePlug == BatteryManager.BATTERY_PLUGGED_USB;
        //boolean acCharge = chargePlug == BatteryManager.BATTERY_PLUGGED_AC;

        int batteryLevel = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, 0);
        int batteryScale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
        int batteryPercent = (batteryLevel * 100) / batteryScale;

        final ContentResolver contentResolver = context.getContentResolver();

        boolean airplaneModeOnBool = isAirplaneModeOn(contentResolver);

        boolean bluetoothOnBool = isBluetoothOn(contentResolver);

        int ringerModeInt = getRingerModeInt(contentResolver);
        String ringerMode = "";
        if (ringerModeInt == AudioManager.RINGER_MODE_SILENT) {
            ringerMode = "silent";
        } else if (ringerModeInt == AudioManager.RINGER_MODE_NORMAL) {
            ringerMode = "normal";
        } else if (ringerModeInt == AudioManager.RINGER_MODE_VIBRATE) {
            ringerMode = "vibrate";
        } else {
            ringerMode = "normal";
        }

        int volumeAlarm = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
        int volumeCall = audioManager.getStreamVolume(AudioManager.STREAM_VOICE_CALL);
        int volumeMusic = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        int volumeRing = audioManager.getStreamVolume(AudioManager.STREAM_RING);
        int volumeSystem = audioManager.getStreamVolume(AudioManager.STREAM_SYSTEM);

        NetworkInfo wifi = connManager.getNetworkInfo(ConnectivityManager.TYPE_WIFI);
        boolean wifiOnBool = wifi.isAvailable();

        JSONObject json = new JSONObject();
        try {
            json.put("api_token", apiToken);
            json.put("user_id", userId);
            json.put("device_id", deviceId);
            json.put("is_charging", isChargingInt);
            json.put("battery_level", batteryPercent);
            json.put("airplane_mode_on", airplaneModeOnBool);
            json.put("bluetooth_on", bluetoothOnBool);
            json.put("wifi_on", wifiOnBool);
            json.put("ringer_mode", ringerMode);
            json.put("ringer_mode_int", ringerModeInt);
            json.put("volume_alarm", volumeAlarm);
            json.put("volume_call", volumeCall);
            json.put("volume_music", volumeMusic);
            json.put("volume_ring", volumeRing);
            json.put("volume_system", volumeSystem);

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        // Send the battery update to our server.
        try {
            String jsonString = json.toString();
            new PhoneDiedUpdateTask().execute(updatePath, jsonString);
        } catch (Exception e) {
            Log.d(TAG, "makeRequest Exception::" + Log.getStackTraceString(e));
        }

        Toast.makeText(context,
                       "Battery: " + batteryPercent + "%",
                       Toast.LENGTH_SHORT).show();

        wl.release();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences settings = context.getApplicationContext().
                getSharedPreferences(PREFS_NAME, 0);
        String apiToken = settings.getString(PhoneDiedService.EXTRAS_API_TOKEN, null);
        String userId = settings.getString(PhoneDiedService.EXTRAS_USER_ID, null);
        String deviceId = settings.getString(PhoneDiedService.EXTRAS_DEVICE_ID, null);
        String updatePath = settings.getString(PhoneDiedService.EXTRAS_UPDATE_PATH, null);
        Log.d(TAG, "onReceive w/ prefs: " + updatePath + ", " + deviceId + ", " + userId);

        if (updatePath != null && deviceId != null && userId != null) {
            SendBatteryStatus(context, apiToken, userId, deviceId, updatePath);
        } else {
            Log.d(TAG, "Unable to SendBatteryStatus - too damn much null!");
        }
    }

    public void SetPrefs(Context context, String apiToken, String userId,
                         String deviceId, String updatePath, String updateFrequency) {
        Log.d(TAG, "SetPrefs: " + updatePath + ", " + deviceId + ", " + userId +
              ", " + updateFrequency);

        SharedPreferences settings = context.getApplicationContext().
                getSharedPreferences(PREFS_NAME, 0);
        SharedPreferences.Editor editor = settings.edit();
        editor.putString(PhoneDiedService.EXTRAS_API_TOKEN, apiToken);
        editor.putString(PhoneDiedService.EXTRAS_USER_ID, userId);
        editor.putString(PhoneDiedService.EXTRAS_DEVICE_ID, deviceId);
        editor.putString(PhoneDiedService.EXTRAS_UPDATE_PATH, updatePath);
        editor.putString(PhoneDiedService.EXTRAS_UPDATE_FREQUENCY, updateFrequency);
        editor.commit();
    }

    public void SetAlarm(Context context) {
        AlarmManager am = (AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, PhoneDiedAlarm.class);
        PendingIntent pi = PendingIntent.getBroadcast(context, 0, intent, 0);

        SharedPreferences settings = context.getApplicationContext().
                getSharedPreferences(PREFS_NAME, 0);
        String updateFrequency = settings.getString(PhoneDiedService.EXTRAS_UPDATE_FREQUENCY, "");

        Log.d(TAG, "SetAlarm! w/ updateFrequency:" + updateFrequency);
        int alarmIntervalMs = 1000 * 60 * Integer.parseInt(updateFrequency);  // Millisec * Second * Minute

        am.setRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis(),
                        alarmIntervalMs, pi);
    }

    public void CancelAlarm(Context context) {
        Log.d(TAG, "CancelAlarm!");
        Intent intent = new Intent(context, PhoneDiedAlarm.class);
        PendingIntent sender = PendingIntent.getBroadcast(context, 0, intent, 0);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarmManager.cancel(sender);
    }
 }



class PhoneDiedUpdateTask extends AsyncTask<String, Void, Void> {
    private static final String TAG = PhoneDiedUpdateTask.class.getSimpleName();

    private Exception exception;

    protected Void doInBackground(String... params) {
        try {
            String updatePath = params[0];
            String jsonString = params[1];

            Log.d(TAG, "doInBackground: " + updatePath + ", " + jsonString);
            //instantiates httpClient to make request
            DefaultHttpClient httpClient = new DefaultHttpClient();

            //url with the post data
            HttpPost httpPost = new HttpPost(updatePath);

            //passes the results to a string builder/entity
            StringEntity se = new StringEntity(jsonString);
            httpPost.setEntity(se);

            //sets a request header so the page receving the request
            //will know what to do with it
            httpPost.setHeader("Accept", "application/json");
            httpPost.setHeader("Content-type", "application/json");

            httpClient.execute(httpPost);
            return null;

        } catch (Exception e) {
            this.exception = e;
            return null;
        }
    }
}
