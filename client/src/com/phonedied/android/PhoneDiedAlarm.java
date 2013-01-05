

package com.phonedied.android;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.AsyncTask;
import android.os.BatteryManager;
import android.os.PowerManager;
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
    private String uuid = "";
    private String authToken = "";
    private String updateFrequency = "";

    public static HttpResponse makeRequest(String updatePath, JSONObject json) throws Exception {
        Log.d(TAG, "makeRequest: " + updatePath + ", " + json.toString());
        //instantiates httpClient to make request
        DefaultHttpClient httpClient = new DefaultHttpClient();

        //url with the post data
        HttpPost httpPost = new HttpPost(updatePath);

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

    public void SendBatteryStatus(Context context, String updatePath,
                                  String uuid, String authToken) {
        Log.d(TAG, "SendBatteryStatus: " + updatePath + ", " + uuid + ", " + authToken);
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

        int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, 0);
        int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, 100);

        int percent = (level*100)/scale;

        JSONObject json = new JSONObject();
        try {
            json.put("auth_token", authToken);
            json.put("uuid", uuid);
            json.put("is_charging", isChargingInt);
            json.put("level", percent);
            Toast.makeText(context, "Battery: " + percent + "%",
                           Toast.LENGTH_LONG).show();

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        // Send the battery update to our server.
        try {
            //makeRequest(updatePath, json);
            new PhoneDiedBatteryUpdateTask().execute(updatePath, json.toString());
        } catch (Exception e) {
            Log.d(TAG, "makeRequest Exception::" + Log.getStackTraceString(e));
        }

        wl.release();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences settings = context.getApplicationContext().
                getSharedPreferences(PREFS_NAME, 0);
        String updatePath = settings.getString(PhoneDiedService.EXTRAS_UPDATE_PATH, null);
        String uuid = settings.getString(PhoneDiedService.EXTRAS_UUID, null);
        String authToken = settings.getString(PhoneDiedService.EXTRAS_AUTH_TOKEN, null);
        Log.d(TAG, "onReceive w/ prefs: " + updatePath + ", " + uuid + ", " + authToken);

        if (updatePath != null && uuid != null && authToken != null) {
            SendBatteryStatus(context, updatePath, uuid, authToken);
        } else {
            Log.d(TAG, "Unable to SendBatteryStatus - too damn much null!");
        }
    }

    public void SetPrefs(Context context, String updatePath, String uuid,
                         String authToken, String updateFrequency) {
        Log.d(TAG, "SetPrefs: " + updatePath + ", " + uuid + ", " + authToken +
              ", " + updateFrequency);

        SharedPreferences settings = context.getApplicationContext().
                getSharedPreferences(PREFS_NAME, 0);
        SharedPreferences.Editor editor = settings.edit();
        editor.putString(PhoneDiedService.EXTRAS_AUTH_TOKEN, authToken);
        editor.putString(PhoneDiedService.EXTRAS_UUID, uuid);
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



class PhoneDiedBatteryUpdateTask extends AsyncTask<String, Void, Void> {
    private static final String TAG = PhoneDiedBatteryUpdateTask.class.getSimpleName();

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
