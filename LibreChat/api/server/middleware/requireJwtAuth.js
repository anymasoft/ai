const cookies = require('cookie');
const passport = require('passport');
const { isEnabled } = require('@librechat/api');

/**
 * Custom Middleware to handle JWT authentication, with support for OpenID token reuse
 * Switches between JWT and OpenID authentication based on cookies and environment settings
 */
const requireJwtAuth = (req, res, next) => {
  const cookieHeader = req.headers.cookie;
  const tokenProvider = cookieHeader ? cookies.parse(cookieHeader).token_provider : null;

  // 🔍 ДИАГНОСТИКА: Логируем информацию о запросе и токене (только в разработке)
  if (process.env.NODE_ENV === 'development') {
    console.log('[DIAGNOSTIC:requireJwtAuth]', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization,
      authHeaderPrefix: req.headers.authorization?.substring(0, 30),
      tokenProvider,
      cookies: Object.keys(req.cookies || {}),
    });
  }

  if (tokenProvider === 'openid' && isEnabled(process.env.OPENID_REUSE_TOKENS)) {
    return passport.authenticate('openidJwt', { session: false })(req, res, next);
  }

  return passport.authenticate('jwt', { session: false })(req, res, next);
};

module.exports = requireJwtAuth;
