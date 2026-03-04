const express = require('express');
const { logger } = require('@librechat/data-schemas');
const SystemSettings = require('~/models/SystemSettings');
const { getLogStores } = require('~/cache');
const { CacheKeys } = require('librechat-data-provider');

const router = express.Router();

/**
 * POST /api/settings
 * Update global system settings
 * Supports:
 * - hideSidePanel: boolean
 */
router.post('/', async (req, res) => {
  try {
    const { hideSidePanel } = req.body;

    if (typeof hideSidePanel === 'boolean') {
      await SystemSettings.setValue('hideSidePanel', hideSidePanel, 'Global setting: hide side panel for users');

      // Invalidate startup config cache to force refresh
      const cache = getLogStores(CacheKeys.CONFIG_STORE);
      await cache.delete(CacheKeys.STARTUP_CONFIG);

      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'hideSidePanel must be a boolean' });
  } catch (error) {
    logger.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/settings
 * Get current system settings
 */
router.get('/', async (req, res) => {
  try {
    const hideSidePanel = await SystemSettings.getValue('hideSidePanel', false);
    return res.json({ hideSidePanel });
  } catch (error) {
    logger.error('Error getting settings:', error);
    return res.status(500).json({ error: 'Failed to get settings' });
  }
});

module.exports = router;
