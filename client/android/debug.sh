#!/bin/bash

ant debug;
ant installd;
adb -d shell am start -n com.elsigh.levels/.LevelsActivity
