package com.phonedied.android;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class PhoneDiedAutoStart extends BroadcastReceiver
{
    PhoneDiedAlarm alarm = new PhoneDiedAlarm();
    @Override
    public void onReceive(Context context, Intent intent)
    {
        if (intent.getAction().equals("android.intent.action.BOOT_COMPLETED"))
        {
            alarm.SetAlarm(context);
        }
    }
}