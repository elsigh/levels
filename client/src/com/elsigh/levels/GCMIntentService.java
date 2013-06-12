
package com.elsigh.levels;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.google.android.gcm.*;

import org.json.JSONException;
import org.json.JSONObject;

import com.marknutter.GCM.GCMPlugin;


public class GCMIntentService extends GCMBaseIntentService {

  public static final String ME="LevelsGCMReceiver";

  public GCMIntentService() {
    super("GCMIntentService");
  }
  private static final String TAG = "GCMIntentService";

  @Override
  public void onRegistered(Context context, String regId) {

    Log.v(ME + ":onRegistered", "Registration ID arrived!");
    Log.v(ME + ":onRegistered", regId);

    JSONObject json;

    try
    {
      json = new JSONObject().put("event", "registered");
      json.put("regid", regId);

      Log.v(ME + ":onRegisterd", json.toString());

      // Send this JSON data to the JavaScript application above EVENT should be set to the msg type
      // In this case this is the registration ID
      GCMPlugin.sendJavascript( json );

    }
    catch( JSONException e)
    {
      // No message to the user is sent, JSON failed
      Log.e(ME + ":onRegisterd", "JSON exception");
    }
  }

  @Override
  public void onUnregistered(Context context, String regId) {
    Log.d(TAG, "onUnregistered - regId: " + regId);
  }

  @Override
  protected void onMessage(Context context, Intent intent) {
    Log.d(TAG, "onMessage");

    // Extract the payload from the message
    Bundle extras = intent.getExtras();
    if (extras != null) {
      String message = extras.getString("message");
      Log.v(ME + "onMessage - message ", message);

      // Status bar notification.
      Notification n = new Notification.Builder(this).
          setSmallIcon(R.drawable.icon_notification).
          setContentTitle("Levels").
          setContentText(extras.getString("message")).build();
      // Hides the notification after its selected.
      n.flags |= Notification.FLAG_AUTO_CANCEL;

      NotificationManager notificationManager =
          (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      notificationManager.notify(1, n);

      // Send the message to the JavaScript application.
      try {
        JSONObject json;
        json = new JSONObject().put("event", "message");
        json.put("message", extras.getString("message"));
        json.put("msgcnt", extras.getString("msgcnt"));
        Log.v(ME + ":onMessage ", json.toString());
        GCMPlugin.sendJavascript(json);

      } catch( JSONException e) {
        Log.e(ME + ":onMessage", "JSON exception");
      }
    }
  }

  @Override
  public void onError(Context context, String errorId) {
    Log.e(TAG, "onError - errorId: " + errorId);
  }




}
