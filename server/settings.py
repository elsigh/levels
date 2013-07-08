import os

MAIL_FROM = 'Levels <elsigh@levelsapp.com>'

ROOT_PATH = os.path.dirname(__file__)

TEMPLATE_DIRS = (
    os.path.join(ROOT_PATH, 'templates')
)

TWILIO_ACCOUNT_SID = "AC13e0edad6a784369a6500a5159be461a"
TWILIO_AUTH_TOKEN = "39e9b2ee9eab31146cac977c1640321c"

SESSION_KEY = 'you gots ta follow dat battery all day erry day'

# Twilio APIs
TWILIO_ACCOUNT_SID = 'AC13e0edad6a784369a6500a5159be461a'
TWILIO_AUTH_TOKEN = '39e9b2ee9eab31146cac977c1640321c'
TWILIO_NUMBER = '+15084525193'

# Google APIs
GOOGLE_APP_ID = '652605517304.apps.googleusercontent.com'
GOOGLE_APP_SECRET = 'rtASdj3HFLHX2D9bCbQ3Mm4U'

# Facebook auth apis
FACEBOOK_APP_ID = '453972198022647'
FACEBOOK_APP_SECRET = 'e9b6ed0c8ac302b1854df454a7b5a77d'


# config that summarizes the above
AUTH_CONFIG = {
    # OAuth 2.0 providers
    'google': (
        GOOGLE_APP_ID,
        GOOGLE_APP_SECRET,
        ('https://www.googleapis.com/auth/userinfo.profile '
         'https://www.googleapis.com/auth/userinfo.email '
         'https://www.googleapis.com/auth/glass.timeline'
         ),
        {'access_type': 'offline', 'approval_prompt': 'force'},
    ),
    'facebook': (
        FACEBOOK_APP_ID,
        FACEBOOK_APP_SECRET,
        'user_about_me',
    ),
}

USER_AGENT = ('Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/28.0.1468.0 Safari/537.36')
