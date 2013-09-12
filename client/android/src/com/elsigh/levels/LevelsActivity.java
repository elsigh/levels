
package com.elsigh.levels;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;

import org.apache.cordova.*;

//import com.elsigh.levels.LevelsService;
//import com.elsigh.levels.LevelsAuthActivity;


public class LevelsActivity extends DroidGap {

    private static final String TAG = LevelsActivity.class.getSimpleName();

    @Override
    public void onCreate(Bundle savedInstanceState) {
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
        super.onCreate(savedInstanceState);
        super.setIntegerProperty("splashscreen", R.drawable.splash);
        super.setBooleanProperty("keepRunning", false);
        super.loadUrl("file:///android_asset/www/index.html", 10000);
        this.appView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
