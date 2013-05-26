package com.elsigh.levels;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class LevelsAutoStart extends BroadcastReceiver
{
    LevelsAlarm alarm = new LevelsAlarm();
    @Override
    public void onReceive(Context context, Intent intent)
    {
        if (intent.getAction().equals("android.intent.action.BOOT_COMPLETED"))
        {
            alarm.SetAlarm(context);
        }
    }
}
