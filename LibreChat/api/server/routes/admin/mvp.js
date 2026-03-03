'use strict';
const express = require('express');
const admin = require('../admin');

const router = express.Router();

// Mount all admin routes under /mvp prefix
// This allows /api/admin/mvp/* requests to be handled by the main admin router
router.use('/', admin);

module.exports = router;
