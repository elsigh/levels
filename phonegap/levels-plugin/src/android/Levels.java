
package com.elsigh.levels;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;

import org.apache.cordova.*;


public class Levels extends CordovaActivity {

    private static final String TAG = Levels.class.getSimpleName();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate w/ " +
              "Build :: " +
              android.os.Build.BRAND + ", " +
              android.os.Build.DEVICE + ", " +
              android.os.Build.MODEL + ", " +
              android.os.Build.PRODUCT + ", " +
              android.os.Build.BRAND + ", " +
              android.os.Build.MANUFACTURER + ", " +
              android.os.Build.DISPLAY + ", " +
              "Build.VERSION.SDK_INT: " + android.os.Build.VERSION.SDK_INT
              );
        super.loadUrl(Config.getStartUrl(), 10000);
    }
}
