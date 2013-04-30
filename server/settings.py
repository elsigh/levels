import os

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

# Google APIs
GOOGLE_APP_ID = 'app id'
GOOGLE_APP_SECRET = 'app secret'

# Facebook auth apis
FACEBOOK_APP_ID = '453972198022647'
FACEBOOK_APP_SECRET = 'e9b6ed0c8ac302b1854df454a7b5a77d'

# https://www.linkedin.com/secure/developer
LINKEDIN_CONSUMER_KEY = 'consumer key'
LINKEDIN_CONSUMER_SECRET = 'consumer secret'

# https://manage.dev.live.com/AddApplication.aspx
# https://manage.dev.live.com/Applications/Index
WL_CLIENT_ID = 'client id'
WL_CLIENT_SECRET = 'client secret'

# https://dev.twitter.com/apps
TWITTER_CONSUMER_KEY = 'oauth1.0a consumer key'
TWITTER_CONSUMER_SECRET = 'oauth1.0a consumer secret'

# https://foursquare.com/developers/apps
FOURSQUARE_CLIENT_ID = 'client id'
FOURSQUARE_CLIENT_SECRET = 'client secret'

# config that summarizes the above
AUTH_CONFIG = {
  # OAuth 2.0 providers
  'google'      : (GOOGLE_APP_ID, GOOGLE_APP_SECRET,
                  'https://www.googleapis.com/auth/userinfo.profile'),
  'facebook'    : (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET,
                  'user_about_me'),
  'windows_live': (WL_CLIENT_ID, WL_CLIENT_SECRET,
                  'wl.signin'),
  'foursquare'  : (FOURSQUARE_CLIENT_ID,FOURSQUARE_CLIENT_SECRET,
                  'authorization_code'),

  # OAuth 1.0 providers don't have scopes
  'twitter'     : (TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET),
  'linkedin'    : (LINKEDIN_CONSUMER_KEY, LINKEDIN_CONSUMER_SECRET),

  # OpenID doesn't need any key/secret
}
