//
//      File: ContactView.m
//  Abstract: Allows you to pick people with whom to share your Levels.
//
//  Created by Edward Marks on 6/22/13.
//
//

#import "ContactView.h"
#import <AddressBookUI/AddressBookUI.h>

@interface ContactView () <ABPeoplePickerNavigationControllerDelegate>
@property (nonatomic, strong) CDVInvokedUrlCommand *command;
@end

@implementation ContactView

- (void)show:(CDVInvokedUrlCommand *)command {
    self.command = command;

    ABPeoplePickerNavigationController *picker = [[ABPeoplePickerNavigationController alloc] init];
    picker.peoplePickerDelegate = self;
    [self.viewController presentViewController:picker animated:YES completion:NULL];
}

- (void)peoplePickerNavigationControllerDidCancel:(ABPeoplePickerNavigationController *)peoplePicker {
    [self.viewController dismissModalViewControllerAnimated:YES];
}

- (BOOL)peoplePickerNavigationController:(ABPeoplePickerNavigationController *)peoplePicker shouldContinueAfterSelectingPerson:(ABRecordRef)person {
    return YES;
}

- (BOOL)peoplePickerNavigationController:(ABPeoplePickerNavigationController *)peoplePicker shouldContinueAfterSelectingPerson:(ABRecordRef)person property:(ABPropertyID)property identifier:(ABMultiValueIdentifier)identifier {
    
    if (property == kABPersonPhoneProperty || property == kABPersonEmailProperty) {

        NSString *name = CFBridgingRelease(ABRecordCopyCompositeName(person));
        ABMultiValueRef pickedSet = ABRecordCopyValue(person, property);
        NSString *phone = CFBridgingRelease(ABMultiValueCopyValueAtIndex(pickedSet, identifier));

        NSDictionary *json = @{
                               @"name" : name,
                               (property == kABPersonPhoneProperty ? @"phone" : @"email") : phone
                               };
        
        CDVPluginResult *pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:json];
        [self.commandDelegate sendPluginResult:pluginResult callbackId:self.command.callbackId];
        
        [self.viewController dismissModalViewControllerAnimated:YES];
    }
    
    return NO;
}


@end
