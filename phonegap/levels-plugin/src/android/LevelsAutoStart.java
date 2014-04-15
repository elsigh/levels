
package com.elsigh.levels;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.elsigh.levels.LevelsService;

public class LevelsAutoStart extends BroadcastReceiver {

    private static final String TAG = LevelsAutoStart.class.getSimpleName();

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "onReceive w/ intent action: " + intent.getAction());
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            Intent.ACTION_PACKAGE_REPLACED.equals(intent.getAction())) {
            Intent service = new Intent(context, LevelsService.class);
            context.startService(service);
        }
    }

}
