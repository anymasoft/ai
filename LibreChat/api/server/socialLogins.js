const passport = require('passport');
const session = require('express-session');
const { CacheKeys } = require('librechat-data-provider');
const { isEnabled, shouldUseSecureCookie } = require('@librechat/api');
const { logger, DEFAULT_SESSION_EXPIRY } = require('@librechat/data-schemas');
const {
  openIdJwtLogin,
  // facebookLogin,
  // discordLogin,
  setupOpenId,
  // googleLogin,
  // githubLogin,
  // appleLogin,
  setupSaml,
  yandexLogin,
} = require('~/strategies');
const { getLogStores } = require('~/cache');

/**
 * Configures OpenID Connect for the application.
 * @param {Express.Application} app - The Express application instance.
 * @returns {Promise<void>}
 */
async function configureOpenId(app) {
  logger.info('Configuring OpenID Connect...');
  const sessionExpiry = Number(process.env.SESSION_EXPIRY) || DEFAULT_SESSION_EXPIRY;
  const sessionOptions = {
    secret: process.env.OPENID_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: getLogStores(CacheKeys.OPENID_SESSION),
    cookie: {
      maxAge: sessionExpiry,
      secure: shouldUseSecureCookie(),
    },
  };
  app.use(session(sessionOptions));
  app.use(passport.session());

  const config = await setupOpenId();
  if (!config) {
    logger.error('OpenID Connect configuration failed - strategy not registered.');
    return;
  }

  if (isEnabled(process.env.OPENID_REUSE_TOKENS)) {
    logger.info('OpenID token reuse is enabled.');
    passport.use('openidJwt', openIdJwtLogin(config));
  }
  logger.info('OpenID Connect configured successfully.');
}

/**
 *
 * @param {Express.Application} app
 */
const configureSocialLogins = async (app) => {
  logger.info('Configuring social logins... (Only Yandex OAuth enabled)');

  // [DISABLED] Google OAuth
  // if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  //   passport.use(googleLogin());
  // }

  // [DISABLED] Facebook OAuth
  // if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  //   passport.use(facebookLogin());
  // }

  // [DISABLED] GitHub OAuth
  // if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  //   passport.use(githubLogin());
  // }

  // [DISABLED] Discord OAuth
  // if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  //   passport.use(discordLogin());
  // }

  // [DISABLED] Apple OAuth
  // if (process.env.APPLE_CLIENT_ID && process.env.APPLE_PRIVATE_KEY_PATH) {
  //   passport.use(appleLogin());
  // }

  // [DISABLED] OpenID Connect
  // if (
  //   process.env.OPENID_CLIENT_ID &&
  //   process.env.OPENID_CLIENT_SECRET &&
  //   process.env.OPENID_ISSUER &&
  //   process.env.OPENID_SCOPE &&
  //   process.env.OPENID_SESSION_SECRET
  // ) {
  //   await configureOpenId(app);
  // }

  // [DISABLED] SAML
  // if (
  //   process.env.SAML_ENTRY_POINT &&
  //   process.env.SAML_ISSUER &&
  //   process.env.SAML_CERT &&
  //   process.env.SAML_SESSION_SECRET
  // ) {
  //   logger.info('Configuring SAML Connect...');
  //   const sessionExpiry = Number(process.env.SESSION_EXPIRY) || DEFAULT_SESSION_EXPIRY;
  //   const sessionOptions = {
  //     secret: process.env.SAML_SESSION_SECRET,
  //     resave: false,
  //     saveUninitialized: false,
  //     store: getLogStores(CacheKeys.SAML_SESSION),
  //     cookie: {
  //       maxAge: sessionExpiry,
  //       secure: shouldUseSecureCookie(),
  //     },
  //   };
  //   app.use(session(sessionOptions));
  //   app.use(passport.session());
  //   setupSaml();
  //
  //   logger.info('SAML Connect configured.');
  // }

  // [ENABLED] Yandex OAuth (Only enabled authentication method)
  if (process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET) {
    logger.info('Registering Yandex OAuth strategy');
    passport.use(yandexLogin());
    logger.info('Yandex OAuth configured successfully.');
  } else {
    logger.warn('Yandex OAuth is the only enabled method, but YANDEX_CLIENT_ID or YANDEX_CLIENT_SECRET is not set!');
  }
};

module.exports = configureSocialLogins;
