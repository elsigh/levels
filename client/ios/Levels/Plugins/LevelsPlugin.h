//
//      Name: LevelsPlugin.h
//  Abstract: Main plugin that handles callbacks from Cordova.
//
//  Created by Edward Marks on 6/22/13.
//
//

#import <Cordova/CDV.h>

@interface LevelsPlugin : CDVPlugin

- (void)getDeviceModelName:(CDVInvokedUrlCommand *)command;
- (void)getVersionCode:(CDVInvokedUrlCommand *)command;
- (void)startService:(CDVInvokedUrlCommand *)command;
- (void)shareApp:(CDVInvokedUrlCommand *)command;

@end
