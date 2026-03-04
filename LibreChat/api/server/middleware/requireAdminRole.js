const { SystemRoles } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');

/**
 * Middleware для проверки, что пользователь имеет роль администратора.
 * Используется для ограничения доступа к чувствительным операциям Settings.
 *
 * Защищаемые операции:
 * - Удаление API ключей (RevokeKeys)
 * - Управление автоматическим пополнением баланса (AutoRefill)
 * - Импорт/очистка разговоров (ImportConversations, ClearChats)
 * - Удаление агента API ключей
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
function requireAdminRole(req, res, next) {
  try {
    const userRole = req.user?.role;

    if (userRole !== SystemRoles.ADMIN) {
      logger.warn(
        `[requireAdminRole] Forbidden access attempt by user ${req.user?.id || 'unknown'} with role ${userRole}`,
      );
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This operation requires administrator privileges',
      });
    }

    next();
  } catch (error) {
    logger.error('[requireAdminRole] Error checking admin role:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while checking permissions',
    });
  }
}

module.exports = requireAdminRole;
