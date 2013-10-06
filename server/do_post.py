import urllib
import urllib2


url = 'http://localhost:8080/auth/google/code_exchange'
data = urllib.urlencode({
    'code': '4/KBqXalcsurXpoWbdAhFI3KZcZCkz.0nHcLxwFhhAYmmS0T3UFEsNMaNTGggI'
})

req = urllib2.Request(url, data)
rsp = urllib2.urlopen(req)
content = rsp.read()
print 'rsp content: %s' % content
