package com.elsigh.levels;


import com.google.android.gms.common.GooglePlayServicesUtil;
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential;
//import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAuthIOException;


import android.accounts.AccountManager;
import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;

import java.util.Arrays;
import java.util.List;

// This is to extend DroidGap, which extends Activity, since I'm using
// Phonegap
import org.apache.cordova.*;


// Again here, this could just be Activity if you weren't using Phonegap.
public class LevelsAuthActivity extends DroidGap {

  private static final String PREF_ACCOUNT_NAME = "accountName";

  private static final String TAG = LevelsAuthActivity.class.getSimpleName();

  private static final int REQUEST_GOOGLE_PLAY_SERVICES = 0;

  private static final int REQUEST_AUTHORIZATION = 1;

  private static final int REQUEST_ACCOUNT_PICKER = 2;

  // You will want to overload this.
  private static final List<String> SCOPES = Arrays.asList(
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile");

  private GoogleAccountCredential credential;


  @Override
  public void onCreate(Bundle savedInstanceState) {
    Log.d(TAG, "onCreate! getting credentials w/ " + SCOPES);
    super.onCreate(savedInstanceState);

    // Google Accounts

    credential = GoogleAccountCredential.usingOAuth2(this, SCOPES);
    SharedPreferences settings = getPreferences(Context.MODE_PRIVATE);
    credential.setSelectedAccountName(settings.getString(PREF_ACCOUNT_NAME, null));
  }

  void showGooglePlayServicesAvailabilityErrorDialog(final int connectionStatusCode) {
    runOnUiThread(new Runnable() {
      public void run() {
        Dialog dialog =
            GooglePlayServicesUtil.getErrorDialog(connectionStatusCode,
                LevelsAuthActivity.this,
                REQUEST_GOOGLE_PLAY_SERVICES);
        dialog.show();
      }
    });
  }


  @Override
  protected void onResume() {
    super.onResume();
    if (checkGooglePlayServicesAvailable()) {
      //haveGooglePlayServices();
    }
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    Log.d(TAG, "onActivityResult " + requestCode + ", " + resultCode + ", " +
          data);
    super.onActivityResult(requestCode, resultCode, data);

    switch (requestCode) {
      case REQUEST_GOOGLE_PLAY_SERVICES:
        if (resultCode == Activity.RESULT_OK) {
          haveGooglePlayServices();
        } else {
          checkGooglePlayServicesAvailable();
        }
        break;

      case REQUEST_AUTHORIZATION:
        if (resultCode == Activity.RESULT_OK) {
          Log.d(TAG, "onActivityResult RESULT_OK!");
        } else {
          chooseAccount();
        }
        break;

      case REQUEST_ACCOUNT_PICKER:
        if (resultCode == Activity.RESULT_OK && data != null && data.getExtras() != null) {
          String accountName = data.getExtras().getString(AccountManager.KEY_ACCOUNT_NAME);
          if (accountName != null) {
            Log.d(TAG, "accountName chosen: " + accountName);
            credential.setSelectedAccountName(accountName);
            SharedPreferences settings = getPreferences(Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = settings.edit();
            editor.putString(PREF_ACCOUNT_NAME, accountName);
            editor.commit();
          }
        }
        break;
    }
  }

  @Override
  public boolean onCreateOptionsMenu(Menu menu) {
    MenuInflater inflater = getMenuInflater();
    inflater.inflate(R.menu.main_menu, menu);
    return super.onCreateOptionsMenu(menu);
  }

  @Override
  public boolean onOptionsItemSelected(MenuItem item) {
    switch (item.getItemId()) {
      case R.id.menu_refresh:
        Log.d(TAG, "onOptionsItemSelected!");
        break;
      case R.id.menu_accounts:
        chooseAccount();
        return true;
    }
    return super.onOptionsItemSelected(item);
  }

  /** Check that Google Play services APK is installed and up to date. */
  private boolean checkGooglePlayServicesAvailable() {
    boolean isGooglePlayServicesAvailable = true;
    final int connectionStatusCode = GooglePlayServicesUtil.isGooglePlayServicesAvailable(this);
    Log.d(TAG, "checkGooglePlayServicesAvailable connectionStatusCode: " +
          connectionStatusCode);
    if (GooglePlayServicesUtil.isUserRecoverableError(connectionStatusCode)) {
      showGooglePlayServicesAvailabilityErrorDialog(connectionStatusCode);
      isGooglePlayServicesAvailable = false;
    }

    Log.d(TAG, "isGooglePlayServicesAvailable?: " + isGooglePlayServicesAvailable);
    return isGooglePlayServicesAvailable;
  }

  private void haveGooglePlayServices() {
    // check if there is already an account selected
    if (credential.getSelectedAccountName() == null) {
      // ask user to choose account
      chooseAccount();
    } else {
      Log.d(TAG, "haveGooglePlayServices ALL GOOD");
    }
  }

  private void chooseAccount() {
    Log.d(TAG, "chooseAccount");
    startActivityForResult(credential.newChooseAccountIntent(), REQUEST_ACCOUNT_PICKER);
  }

}
