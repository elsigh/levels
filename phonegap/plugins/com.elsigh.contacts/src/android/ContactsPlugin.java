package com.elsigh.contacts;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.util.Log;
import android.widget.Toast;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;


public class ContactsPlugin extends CordovaPlugin {
	private static final String TAG = ContactsPlugin.class.getSimpleName();

	private CallbackContext contactsCallbackContext = null;

	private static final int PICK_CONTACT = 1;
	private String emailOrPhone;

	@Override
	public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
		Log.d(TAG, "execute w/ " + action + " args: " + args);

		try {
			emailOrPhone = args.getString(0);
		} catch (JSONException e) {
			e.printStackTrace();
			return false;
		}

		this.contactsCallbackContext = callbackContext;

		startContactActivity();
		PluginResult result = new PluginResult(PluginResult.Status.NO_RESULT);
		result.setKeepCallback(true);
		callbackContext.sendPluginResult(result);
		return true;
	}

	public void startContactActivity() {
		Log.d(TAG, "emailOrPhone:"  + this.emailOrPhone);
		Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI);
		//intent.setType(ContactsContract.Contacts.CONTENT_TYPE);
		if (emailOrPhone.equals("phone")) {
			intent.setType(ContactsContract.CommonDataKinds.Phone.CONTENT_TYPE);
		} else {
			intent.setType(ContactsContract.CommonDataKinds.Email.CONTENT_TYPE);
		}
		this.cordova.startActivityForResult((CordovaPlugin) this, intent, PICK_CONTACT);
	}

	@Override
	public void onActivityResult(int reqCode, int resultCode, Intent data) {
		String name = null;
		String phoneNumber = null;
		String email = null;
		Log.d(TAG, "onActivityResult reqCode:" + reqCode +
			  ", resultCode:" + resultCode + ", data:" + data);
		switch (reqCode) {
	        case (PICK_CONTACT):
				if (resultCode == Activity.RESULT_OK) {
					Uri contactData = data.getData();
					Cursor c = this.cordova.getActivity().managedQuery(contactData, null, null, null, null);
					if (c.moveToFirst()) {
						String contactID = c.getString(c
								.getColumnIndex(ContactsContract.Contacts._ID));
						name = c.getString(c.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME));
						Log.d(TAG, "PICKED AOK contactID:" + contactID +
							  ", name:" + name);

						if (this.emailOrPhone.equals("phone")) {
							Cursor cursor = this.cordova.getActivity().getContentResolver().query(
				            	ContactsContract.CommonDataKinds.Phone.CONTENT_URI, null,
				              	ContactsContract.CommonDataKinds.Phone._ID + "=?",
				              	new String[]{contactID}, null);
							cursor.moveToFirst();
                 			int idx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                 			phoneNumber = cursor.getString(idx);

						} else {
							Cursor cursor = this.cordova.getActivity().getContentResolver().query(
				            	ContactsContract.CommonDataKinds.Email.CONTENT_URI, null,
				              	ContactsContract.CommonDataKinds.Email._ID + "=?",
				              	new String[]{contactID}, null);
							cursor.moveToFirst();
                 			int idx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.ADDRESS);
                 			email = cursor.getString(idx);

						}

						JSONObject contactObject = new JSONObject();
						try {
							contactObject.put("name", name);
							contactObject.put("phone", phoneNumber);
							contactObject.put("email", email);
						} catch (JSONException e) {
							e.printStackTrace();
						}


						this.contactsCallbackContext.sendPluginResult(
								new PluginResult(PluginResult.Status.OK, contactObject));
					}
				}
				break;
		}
	}
}
