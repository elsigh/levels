#!/bin/bash

adb debug;
adb installd;
adb -d shell am start -n com.elsigh.levels/.LevelsActivity
