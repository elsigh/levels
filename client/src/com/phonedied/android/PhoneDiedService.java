

package com.phonedied.android;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;
import android.provider.Settings.Secure;
import android.util.Log;
import android.widget.Toast;

import org.json.JSONObject;
import org.json.JSONException;

import com.phonedied.android.PhoneDiedAlarm;

public class PhoneDiedService extends Service {

    private static final String TAG = PhoneDiedService.class.getSimpleName();

    private Boolean isRunning = false;

    public static String EXTRAS_AUTH_TOKEN = "auth_token";
    public static String EXTRAS_UUID = "uuid";
    public static String EXTRAS_UPDATE_PATH = "update_path";
    public static String EXTRAS_UPDATE_FREQUENCY = "update_frequency";

    PhoneDiedAlarm alarm = new PhoneDiedAlarm();

    //MixpanelAPI mMixpanel = null;

    //public static final String mixpanelToken = "05816db61e038417de78b3ebc0859168";

    public Boolean isRunning() {
        return isRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "onCreate");
    }

    @Override
    public void onStart(Intent intent, int startId) {
        super.onStart(intent, startId);
        Log.d(TAG, "onStart");

        if (intent != null) {
            String authToken = intent.getStringExtra(EXTRAS_AUTH_TOKEN);
            String uuid = intent.getStringExtra(EXTRAS_UUID);
            String updatePath = intent.getStringExtra(EXTRAS_UPDATE_PATH);
            String updateFrequency = intent.getStringExtra(EXTRAS_UPDATE_FREQUENCY);
            Log.d(TAG, "onStart, w/ intent" +
                  authToken + ", " + uuid + ", " +
                  updatePath + ", " + updateFrequency);
            alarm.SetPrefs(this, updatePath, uuid, authToken, updateFrequency);
        }

        if (!isRunning) {
            alarm.SetAlarm(this);
            isRunning = true;
            Toast.makeText(this.getApplicationContext(),
                           "Battery updates ENABLED.",
                           Toast.LENGTH_LONG).show();

        // Update the alarm timing.
        } else {
            alarm.CancelAlarm(this);
            alarm.SetAlarm(this);
            Toast.makeText(this.getApplicationContext(),
                           "Battery updates ENABLED (updated).",
                           Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand!");
        onStart(intent, startId);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy!");
        alarm.CancelAlarm(this);
        if (isRunning) {
            Toast.makeText(this.getApplicationContext(),
                           "Battery updates DISABLED.",
                           Toast.LENGTH_LONG).show();
        }
        isRunning = false;
    }
}
