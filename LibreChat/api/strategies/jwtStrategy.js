const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { getUserById, updateUser } = require('~/models');

// JWT strategy
const jwtLogin = () =>
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        // 🔍 ДИАГНОСТИКА: Логируем JWT payload
        console.log('[DIAGNOSTIC:jwtStrategy] JWT payload received:', {
          id: payload?.id,
          iat: payload?.iat,
          exp: payload?.exp,
          hasId: !!payload?.id,
        });

        const user = await getUserById(payload?.id, '-password -__v -totpSecret -backupCodes');
        console.log('[DIAGNOSTIC:jwtStrategy] User lookup result:', {
          userId: payload?.id,
          found: !!user,
          role: user?.role,
          email: user?.email,
        });

        if (user) {
          user.id = user._id.toString();
          if (!user.role) {
            console.log('[DIAGNOSTIC:jwtStrategy] User has no role, setting to:', SystemRoles.USER);
            user.role = SystemRoles.USER;
            await updateUser(user.id, { role: user.role });
          }
          console.log('[DIAGNOSTIC:jwtStrategy] Authentication successful, user role:', user.role);
          done(null, user);
        } else {
          console.log('[DIAGNOSTIC:jwtStrategy] User not found for id:', payload?.id);
          logger.warn('[jwtLogin] JwtStrategy => no user found: ' + payload?.id);
          done(null, false);
        }
      } catch (err) {
        console.log('[DIAGNOSTIC:jwtStrategy] Error during JWT verification:', {
          message: err.message,
          code: err.code,
          name: err.name,
        });
        logger.error('[jwtLogin] JwtStrategy error:', err);
        done(err, false);
      }
    },
  );

module.exports = jwtLogin;
