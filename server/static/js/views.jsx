
/** @jsx React.DOM */
fmb.views.HowItWorks = React.createClass({
  render: function() {
    return (
      <div>
        <h2>How Levels Works</h2>
        <p>
          Levels sends your battery status to our server every
          10 minutes.
        </p>
        <p>
          When your battery goes down below 10%
          we'll send you, and anyone you'd like, a notification.
          Levels sends, at most, one message every 12 hours.
        </p>
        <p>
          You can install Levels on your phones, tablets, remote controls,
          etc ... and then manage all your notification settings in the App.
        </p>
        <p>
          <a href="account" className="fmb-app-link fmb-btn"
            >Get this party started!</a>
        </p>
      </div>
    );
  }
});


/** @jsx React.DOM */
fmb.views.AccountInfo = React.createClass({
  templateWithoutApiToken: function() {
    return (
      <div>
        <p>
          Levels will send you, and anyone you configure, a
          notification <strong>before</strong> your battery dies!

          <span className="how-it-works-c">
            {' '}<a
              href="how_it_works" className="fmb-app-link"
              >Read more about how it works</a>
          </span>
        </p>

        <div className="login-google"
          onClick={this.props.onClickLogin}
          ><span>Sign in with Google</span></div>

        <p className="signin-info">
          <em>
            This will open a new window for you to sign in and
            then bring you back to the app.
          </em>
        </p>
        <p className="signin-info">
          <em>
            Levels will <strong>never</strong> automatically
            post anything to any social network on your behalf.
          </em>
        </p>
      </div>
    );
  },
  templateWithApiToken: function() {
    return (
      <div className="user-header">
        <img src={this.props.model.get('avatar_url')} alt="" />
        <div className="user-info">
          <h2>{this.props.model.get('name')}</h2>

          <div>
            <div className="share">
              levelsapp.com/p/{this.props.model.get('unique_profile_str')}
            </div>
          </div>

          {this.props.model.get('is_gmail_account') &&
            <div className="label-c">
              <label>
                <input
                  type="checkbox"
                  name="allow_gmail_lookup"
                  onChange={this.props.onChangeAllowGmailLookup}
                  checked={this.props.model.get('allow_gmail_lookup')} />
                Use gmail name for my profile url.
              </label>
            </div>
          }

        </div>
      </div>
    );
  },
  render: function() {
    return this.props.model.get('api_token') ?
        this.templateWithApiToken() :
        this.templateWithoutApiToken();
  }
});


/** @jsx React.DOM */
fmb.views.DeviceInfo = React.createClass({
  componentDidMount: function() {
    this.props.model.on('change', function() {
      this.forceUpdate();
    }.bind(this));
  },
  render: function() {
    return (
      <div>
        {this.props.model.get('is_user_device') &&
         this.props.model.has('key') &&
          <paper-button raised
            onClick={this.props.onClickRemove}
            className="fmb-remove device-remove"
            data-key={this.props.model.get('key')}>X</button>
        }
        <h3>
          {this.props.model.get('platform')}
          {this.props.model.get('name')}
        </h3>
      </div>
    );
  }
});
