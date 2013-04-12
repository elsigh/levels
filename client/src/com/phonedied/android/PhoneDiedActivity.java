
package com.phonedied.android;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import org.apache.cordova.*;

//import com.google.android.gms.auth.GoogleAuthUtil;
//import com.google.android.gms.common.GooglePlayServicesUtil;

import com.phonedied.android.PhoneDiedService;


public class PhoneDiedActivity extends DroidGap {

    private static final String TAG = PhoneDiedActivity.class.getSimpleName();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "PhoneDiedActivity onCreate w/ " +
              "Build.DEVICE:: " + android.os.Build.DEVICE + ", " +
              android.os.Build.MODEL + ", " + android.os.Build.PRODUCT + ", " +
              "Build.VERSION.SDK_INT: " + android.os.Build.VERSION.SDK_INT);
        super.setIntegerProperty("splashscreen", R.drawable.splash);
        super.setBooleanProperty("keepRunning", false);
        super.loadUrl("file:///android_asset/www/index.html", 10000);
    }

}
