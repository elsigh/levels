package com.phonedied.android;

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

import com.phonedied.android.PhoneDiedService;

public class PhoneDiedPlugin extends Plugin {
    private static final String TAG = PhoneDiedActivity.class.getSimpleName();

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
                                       PhoneDiedService.class);

            String apiToken = "";
            String uuid = "";
            String updateFrequency = "";
            String updatePath = "";
            try {
                apiToken = args.getString(0);
                uuid = args.getString(1);
                updateFrequency = args.getString(2);
                updatePath = args.getString(3);
            } catch(JSONException e) {
              e.printStackTrace();
              return new PluginResult(PluginResult.Status.JSON_EXCEPTION);
            }

            intent.putExtra(PhoneDiedService.EXTRAS_API_TOKEN, apiToken);
            intent.putExtra(PhoneDiedService.EXTRAS_UUID, uuid);
            intent.putExtra(PhoneDiedService.EXTRAS_UPDATE_FREQUENCY, updateFrequency);
            intent.putExtra(PhoneDiedService.EXTRAS_UPDATE_PATH, updatePath);

            this.cordova.getActivity().startService(intent);

            return new PluginResult(status, "Started service.");


        } else if (action.equals("stopService")) {
            Intent intent = new Intent(this.cordova.getActivity(),
                PhoneDiedService.class);
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

        } else {
            return new PluginResult(PluginResult.Status.INVALID_ACTION);
        }
    }
}


