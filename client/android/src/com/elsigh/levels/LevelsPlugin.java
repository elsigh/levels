package com.elsigh.levels;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import org.apache.cordova.api.Plugin;
import org.apache.cordova.api.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import android.widget.Toast;

import com.elsigh.levels.LevelsService;

public class LevelsPlugin extends Plugin {
    private static final String TAG = LevelsActivity.class.getSimpleName();

    /**
     * @param action Contains the action sent by the javascript. This can be used
     *               to do more than one action when javascript calls this plugin.
     *               e.g for File Plugin, the action could be LIST,MKDIR,DELETE, etc
     * @param args   The arguments coming from JavaScript API to the native. This is an
     *               JSON Object. e.g for File Plugin are filename,path,etc
     */
    @Override
    public PluginResult execute(String action, JSONArray args, String callbackId) {
        PluginResult.Status status = PluginResult.Status.OK;
        Log.d(TAG, "action:" + action + ", args:" + args);

        if (action.equals("startService")) {
            Intent intent = new Intent(this.cordova.getActivity(),
                                       LevelsService.class);

            String apiToken = "";
            String userKey = "";
            String deviceKey = "";
            String updateFrequency = "";
            String updatePath = "";
            try {
                apiToken = args.getString(0);
                userKey = args.getString(1);
                deviceKey = args.getString(2);
                updateFrequency = args.getString(3);
                updatePath = args.getString(4);
            } catch(JSONException e) {
              e.printStackTrace();
              return new PluginResult(PluginResult.Status.JSON_EXCEPTION);
            }

            intent.putExtra(LevelsService.EXTRAS_API_TOKEN, apiToken);
            intent.putExtra(LevelsService.EXTRAS_USER_KEY, userKey);
            intent.putExtra(LevelsService.EXTRAS_DEVICE_KEY, deviceKey);
            intent.putExtra(LevelsService.EXTRAS_UPDATE_FREQUENCY, updateFrequency);
            intent.putExtra(LevelsService.EXTRAS_UPDATE_PATH, updatePath);

            this.cordova.getActivity().startService(intent);

            return new PluginResult(status, "Started service.");


        } else if (action.equals("stopService")) {
            Intent intent = new Intent(this.cordova.getActivity(),
                LevelsService.class);
            this.cordova.getActivity().stopService(intent);

            return new PluginResult(status, "Stopped service.");

        } else if (action.equals("showToast")) {
            String textArg = "";
            try {
                textArg = args.getString(0);
            } catch (JSONException e) {}

            final String text = textArg;
            final Activity activity = this.cordova.getActivity();

            activity.runOnUiThread(new Runnable() {
              public void run() {
                Log.d(TAG, "Showing toast: " + text);
                Toast.makeText(activity.getApplicationContext(),
                               text, Toast.LENGTH_SHORT).show();
              }
            });
            return new PluginResult(status, "");


        } else if (action.equals("getDeviceModelName")) {
            return new PluginResult(status, android.os.Build.MODEL);

        } else if (action.equals("getVersionName")) {
            String versionName = activity.getApplicationContext().
                getPackageManager().getPackageInfo(getPackageName(), 0).versionName
            return new PluginResult(status, versionName);

        } else {
            return new PluginResult(PluginResult.Status.INVALID_ACTION);
        }
    }
}


