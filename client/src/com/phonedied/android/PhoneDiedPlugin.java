package com.phonedied.android;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import org.apache.cordova.api.Plugin;
import org.apache.cordova.api.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.phonedied.android.PhoneDiedService;

public class PhoneDiedPlugin extends Plugin {

    /**
     * @param action Contains the action sent by the javascript. This can be used
     *               to do more than one action when javascript calls this plugin.
     *               e.g for File Plugin, the action could be LIST,MKDIR,DELETE, etc
     * @param data   The arguments coming from JavaScript API to the native. This is an
     *               JSON Object. e.g for File Plugin are filename,path,etc
     */
    @Override
    public PluginResult execute(String action, JSONArray data, String callbackId) {
        PluginResult.Status status = PluginResult.Status.OK;
        Log.d("PhoneDiedPlugin", "action:" + action);

        if (action.equals("startService")) {
            Intent intent = new Intent(this.cordova.getActivity(),
                                       PhoneDiedService.class);

            String authToken = "";
            String uuid = "";
            String updateFrequency = "";
            String updatePath = "";
            try {
                authToken = data.getString(0);
                uuid = data.getString(1);
                updateFrequency = data.getString(2);
                updatePath = data.getString(3);
            } catch(JSONException e) {
              e.printStackTrace();
              return new PluginResult(PluginResult.Status.JSON_EXCEPTION);
            }

            intent.putExtra(PhoneDiedService.EXTRAS_AUTH_TOKEN, authToken);
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

        } else {
            return new PluginResult(PluginResult.Status.INVALID_ACTION);
        }
    }
}


