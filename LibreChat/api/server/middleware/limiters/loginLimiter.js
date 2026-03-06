const rateLimit = require('express-rate-limit');
const { limiterCache } = require('@librechat/api');
const { ViolationTypes } = require('librechat-data-provider');
const { removePorts } = require('~/server/utils');
const { logViolation } = require('~/cache');

const { LOGIN_WINDOW = 5, LOGIN_MAX = 7, LOGIN_VIOLATION_SCORE: score } = process.env;
const windowMs = LOGIN_WINDOW * 60 * 1000;
const max = LOGIN_MAX;
const windowInMinutes = windowMs / 60000;
const message = `Too many login attempts, please try again after ${windowInMinutes} minutes.`;

const handler = async (req, res) => {
  const type = ViolationTypes.LOGINS;
  const errorMessage = {
    type,
    max,
    windowInMinutes,
  };

  await logViolation(req, res, type, errorMessage, score);
  return res.status(429).json({ message });
};

const limiterOptions = {
  windowMs,
  max,
  handler,
  keyGenerator: removePorts,
  store: limiterCache('login_limiter'),
};

const loginLimiter = rateLimit(limiterOptions);

// Обернуть limiter для отключения в режиме разработки
const wrappedLoginLimiter = (req, res, next) => {
  // В режиме разработки пропустить rate limiting для OAuth авторизации
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  // В production применять rate limiting
  return loginLimiter(req, res, next);
};

module.exports = wrappedLoginLimiter;

