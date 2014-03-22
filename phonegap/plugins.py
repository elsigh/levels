#!/usr/bin/python

import json

f = open('plugins.json')
data_map = json.loads(f.read())
f.close()

for plugin in data_map['plugins']:
    print 'cordova plugin remove %s' % plugin['id']

print '\n\n'

#for plugin in data_map['plugins']:
#    print 'cordova plugin add %s' % plugin['src']
