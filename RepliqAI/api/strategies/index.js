const { setupOpenId, getOpenIdConfig, getOpenIdEmail } = require('./openidStrategy');
const openIdJwtLogin = require('./openIdJwtStrategy');
// [DISABLED] facebookLogin,
// const facebookLogin = require('./facebookStrategy');
// [DISABLED] discordLogin
// const discordLogin = require('./discordStrategy');
const passportLogin = require('./localStrategy');
// [DISABLED] googleLogin
// const googleLogin = require('./googleStrategy');
// [DISABLED] githubLogin
// const githubLogin = require('./githubStrategy');
const { setupSaml } = require('./samlStrategy');
// [DISABLED] appleLogin
// const appleLogin = require('./appleStrategy');
const ldapLogin = require('./ldapStrategy');
const jwtLogin = require('./jwtStrategy');
// [ENABLED] Yandex OAuth (Only enabled)
const yandexLogin = require('./yandexStrategy');

module.exports = {
  // [DISABLED] appleLogin,
  passportLogin,
  // [DISABLED] googleLogin,
  // [DISABLED] githubLogin,
  // [DISABLED] discordLogin,
  jwtLogin,
  // [DISABLED] facebookLogin,
  setupOpenId,
  getOpenIdConfig,
  getOpenIdEmail,
  ldapLogin,
  setupSaml,
  openIdJwtLogin,
  // [ENABLED] Yandex OAuth (Only enabled)
  yandexLogin,
};
