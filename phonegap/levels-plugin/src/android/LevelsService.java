

package com.elsigh.levels;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;
import android.provider.Settings.Secure;
import android.util.Log;
import android.widget.Toast;

import org.json.JSONObject;
import org.json.JSONException;

import com.elsigh.levels.LevelsAlarm;

public class LevelsService extends Service {

    private static final String TAG = LevelsService.class.getSimpleName();

    private Boolean isRunning = false;

    public static String EXTRAS_API_TOKEN = "api_token";
    public static String EXTRAS_USER_KEY = "user_key";
    public static String EXTRAS_DEVICE_KEY = "device_key";
    public static String EXTRAS_UPDATE_PATH = "update_path";
    public static String EXTRAS_UPDATE_FREQUENCY = "update_frequency";

    LevelsAlarm alarm = new LevelsAlarm();

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
        Log.d(TAG, "onStart isRunning? " + isRunning);

        if (intent != null) {
            String apiToken = intent.getStringExtra(EXTRAS_API_TOKEN);
            String userKey = intent.getStringExtra(EXTRAS_USER_KEY);
            String deviceKey = intent.getStringExtra(EXTRAS_DEVICE_KEY);
            String updatePath = intent.getStringExtra(EXTRAS_UPDATE_PATH);
            String updateFrequency = intent.getStringExtra(EXTRAS_UPDATE_FREQUENCY);
            Log.d(TAG, "onStart via intent: " +
                  apiToken + ", " + userKey + ", " + deviceKey + ", " +
                  updatePath + ", " + updateFrequency);

            // These may not be set if we're starting from LevelsAutoStart.
            if (apiToken != null &&
                userKey != null &&
                deviceKey != null &&
                updatePath != null &&
                updateFrequency != null) {

                alarm.SetPrefs(this, apiToken, userKey, deviceKey, updatePath, updateFrequency);

                if (isRunning) {
                    //Toast.makeText(this.getApplicationContext(),
                    //               "Battery updates are ON",
                    //               Toast.LENGTH_SHORT).show();
                    alarm.SendBatteryStatus(this.getApplicationContext(),
                        apiToken, userKey, deviceKey, updatePath);
                }
            } else {
                Log.d(TAG, "no Intent extras, so just a simple service start.");
            }
        }

        if (!isRunning) {
            alarm.SetAlarm(this);
            isRunning = true;
            //Toast.makeText(this.getApplicationContext(),
            //               "Battery updates ENABLED",
            //               Toast.LENGTH_SHORT).show();
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
