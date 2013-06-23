//
//      Name: LevelsPlugin.m
//  Abstract: Main plugin that handles callbacks from Cordova.
//
//  Created by Edward Marks on 6/22/13.
//
//

#import "LevelsPlugin.h"
#import <Cordova/CDV.h>
#import "AFNetworking.h"

@implementation LevelsPlugin

- (void)getDeviceModelName:(CDVInvokedUrlCommand *)command {
    NSString *model = [[UIDevice currentDevice] model];
    
    CDVPluginResult *pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:model];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)getVersionCode:(CDVInvokedUrlCommand *)command {

    NSString *buildNumberString = [[NSBundle mainBundle] objectForInfoDictionaryKey:(NSString *)kCFBundleVersionKey];
    NSInteger buildNumber = [buildNumberString intValue];
    
    CDVPluginResult *pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:buildNumber];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

static NSString *kUserDefaultsKeyAPIToken = @"kUserDefaultsKeyAPIToken";
static NSString *kUserDefaultsKeyUserKey = @"kUserDefaultsKeyUserKey";
static NSString *kUserDefaultsKeyDeviceKey = @"kUserDefaultsKeyDeviceKey";
static NSString *kUserDefaultsKeyUpdateFrequency = @"kUserDefaultsKeyUpdateFrequency";
static NSString *kUserDefaultsKeyUpdatePath = @"kUserDefaultsKeyUpdatePath";

- (void)startService:(CDVInvokedUrlCommand *)command {

    NSString *apiToken = nil;
    NSString *userKey = nil;
    NSString *deviceKey = nil;
    NSNumber *updateFrequency = nil;
    NSString *updatePath = nil;
    
    if ([command.arguments count] == 5) {
        apiToken = command.arguments[0];
        userKey = command.arguments[1];
        deviceKey = command.arguments[2];
        updateFrequency = command.arguments[3];
        updatePath = command.arguments[4];
        
        // Save values to disk for when app is launched on device launch.
        [[NSUserDefaults standardUserDefaults] setObject:apiToken forKey:kUserDefaultsKeyAPIToken];
        [[NSUserDefaults standardUserDefaults] setObject:userKey forKey:kUserDefaultsKeyUserKey];
        [[NSUserDefaults standardUserDefaults] setObject:deviceKey forKey:kUserDefaultsKeyDeviceKey];
        [[NSUserDefaults standardUserDefaults] setObject:updateFrequency forKey:kUserDefaultsKeyUpdateFrequency];
        [[NSUserDefaults standardUserDefaults] setObject:updatePath forKey:kUserDefaultsKeyUpdatePath];
    } else {
        apiToken = [[NSUserDefaults standardUserDefaults] stringForKey:kUserDefaultsKeyAPIToken];
        userKey  = [[NSUserDefaults standardUserDefaults] stringForKey:kUserDefaultsKeyUserKey];
        deviceKey = [[NSUserDefaults standardUserDefaults] stringForKey:kUserDefaultsKeyDeviceKey];
        updateFrequency = [[NSUserDefaults standardUserDefaults] objectForKey:kUserDefaultsKeyUpdateFrequency];
        updatePath = [[NSUserDefaults standardUserDefaults] objectForKey:kUserDefaultsKeyUpdatePath];
    }
    
    if (apiToken && userKey && deviceKey && updateFrequency && updatePath) {

        // Do one beacon immediately.
        [self updateServerWithDeviceStatusWithAPIToken:apiToken userKey:userKey deviceKey:deviceKey updatePath:updatePath];
    
        // Schedule beacons to run on the specified time interval.
        [[UIApplication sharedApplication] setKeepAliveTimeout:([updateFrequency intValue] * 60) handler:^{
            [self updateServerWithDeviceStatusWithAPIToken:apiToken userKey:userKey deviceKey:deviceKey updatePath:updatePath];
        }];
    }
}

- (void)updateServerWithDeviceStatusWithAPIToken:(NSString *)apiToken userKey:(NSString *)userKey deviceKey:(NSString *)deviceKey updatePath:(NSString *)updatePath {
    CGFloat batteryLevel = fabs([[UIDevice currentDevice] batteryLevel]);
    BOOL isCharging = ([[UIDevice currentDevice] batteryState] == UIDeviceBatteryStateCharging);

    NSDictionary *jsonPayload = @{
                                  @"api_token" : apiToken,
                                  @"user_key" : userKey,
                                  @"device_key" : deviceKey,
                                  @"is_charging" : [NSNumber numberWithBool:isCharging],
                                  @"battery_level" : [NSNumber numberWithInt:nearbyint(100 * batteryLevel)]
                                  };
    NSData *data = [NSJSONSerialization dataWithJSONObject:jsonPayload options:NSJSONWritingPrettyPrinted error:NULL];

    NSURL *url = [NSURL URLWithString:updatePath];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setHTTPMethod:@"POST"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-type"];
    [request setHTTPBody:data];
    
    AFURLConnectionOperation *operation = [AFJSONRequestOperation JSONRequestOperationWithRequest:request success:NULL failure:NULL];
    [operation start];
}

- (void)shareApp:(CDVInvokedUrlCommand *)command {
    if ([command.arguments count] < 2)
        return;

    NSString *sharingText = command.arguments[1];
    UIActivityViewController *test = [[UIActivityViewController alloc] initWithActivityItems:@[sharingText] applicationActivities:nil];
    [self.viewController presentViewController:test animated:YES completion:NULL];
}

@end
