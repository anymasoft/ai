const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
  updateFavoritesController,
  getFavoritesController,
} = require('~/server/controllers/FavoritesController');
const { requireJwtAuth } = require('~/server/middleware');
const requireAdminRole = require('~/server/middleware/requireAdminRole');
const SystemSettings = require('~/models/SystemSettings');
const { getLogStores } = require('~/cache');
const { CacheKeys } = require('librechat-data-provider');

const router = express.Router();

router.get('/favorites', requireJwtAuth, getFavoritesController);
router.post('/favorites', requireJwtAuth, updateFavoritesController);

/**
 * POST /api/settings
 * Update global system settings (admin only)
 * Supports:
 * - hideSidePanel: boolean
 */
router.post('/', requireJwtAuth, requireAdminRole, async (req, res) => {
  try {
    const { hideSidePanel } = req.body;

    if (typeof hideSidePanel !== 'boolean' && hideSidePanel !== undefined) {
      return res.status(400).send({ error: 'hideSidePanel must be a boolean' });
    }

    if (hideSidePanel !== undefined) {
      await SystemSettings.setValue('hideSidePanel', hideSidePanel, 'Global setting: hide side panel for users');

      // Invalidate startup config cache to force refresh
      const cache = getLogStores(CacheKeys.CONFIG_STORE);
      await cache.delete(CacheKeys.STARTUP_CONFIG);
    }

    return res.status(200).send({ success: true });
  } catch (error) {
    logger.error('Error updating settings:', error);
    return res.status(500).send({ error: 'Failed to update settings' });
  }
});

module.exports = router;
