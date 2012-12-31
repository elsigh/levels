
package com.phonedied.android;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import org.apache.cordova.*;

import com.phonedied.android.PhoneDiedService;


public class PhoneDiedActivity extends DroidGap {

    private static final String TAG = PhoneDiedActivity.class.getSimpleName();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "BUILD:: " + android.os.Build.DEVICE + ", " +
              android.os.Build.MODEL + ", " + android.os.Build.PRODUCT);
        super.setIntegerProperty("splashscreen", R.drawable.splash);
        //super.setBooleanProperty("keepRunning", false);
        super.loadUrl("file:///android_asset/www/index.html", 10000);
    }

}
