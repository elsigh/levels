package com.elsigh.levels;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager.NameNotFoundException;
import android.net.Uri;
import android.util.Log;
import android.widget.Toast;

import org.apache.cordova.api.CallbackContext;
import org.apache.cordova.api.CordovaPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.elsigh.levels.LevelsService;

public class LevelsPlugin extends CordovaPlugin {
    private static final String TAG = LevelsPlugin.class.getSimpleName();

    /**
     * @param action Contains the action sent by the javascript. This can be used
     *               to do more than one action when javascript calls this plugin.
     *               e.g for File Plugin, the action could be LIST,MKDIR,DELETE, etc
     * @param args   The arguments coming from JavaScript API to the native. This is an
     *               JSON Object. e.g for File Plugin are filename,path,etc
     */
    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
        Log.d(TAG, "action:" + action + ", args:" + args);

        String successResponse = "";

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
                callbackContext.error(Log.getStackTraceString(e));
                return false;

            }

            intent.putExtra(LevelsService.EXTRAS_API_TOKEN, apiToken);
            intent.putExtra(LevelsService.EXTRAS_USER_KEY, userKey);
            intent.putExtra(LevelsService.EXTRAS_DEVICE_KEY, deviceKey);
            intent.putExtra(LevelsService.EXTRAS_UPDATE_FREQUENCY, updateFrequency);
            intent.putExtra(LevelsService.EXTRAS_UPDATE_PATH, updatePath);

            this.cordova.getActivity().startService(intent);

            successResponse = "Started service.";

        } else if (action.equals("stopService")) {
            Intent intent = new Intent(this.cordova.getActivity(),
                LevelsService.class);
            this.cordova.getActivity().stopService(intent);
            successResponse = "Stopped service.";

        } else if (action.equals("showMessage")) {
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

        } else if (action.equals("getDeviceModelName")) {
            successResponse = android.os.Build.MODEL;

        } else if (action.equals("getVersionCode")) {
            final Context context = this.cordova.getActivity().getApplicationContext();
            int versionCode = 1;
            try {
                versionCode = context.getPackageManager().getPackageInfo(
                    context.getPackageName(), 0).versionCode;
            } catch (NameNotFoundException e) {
                e.printStackTrace();
                Log.d(TAG, "getVersionCode ERROR");
            }
            successResponse = versionCode + "";  // cast to string

        } else {
            callbackContext.error("Invalid action: " + action);
            return false;
        }

        callbackContext.success(successResponse);
        return true;
    }
}


