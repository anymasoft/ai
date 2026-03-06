const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const fs = require('fs');
require('module-alias')({ base: path.resolve(__dirname, '..') });
const cors = require('cors');
const axios = require('axios');
const express = require('express');
const passport = require('passport');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { logger } = require('@librechat/data-schemas');
const mongoSanitize = require('express-mongo-sanitize');
const {
  isEnabled,
  apiNotFound,
  ErrorController,
  memoryDiagnostics,
  performStartupChecks,
  handleJsonParseError,
  GenerationJobManager,
  createStreamServices,
  initializeFileStorage,
} = require('@librechat/api');
const { connectDb, indexSync } = require('~/db');
const initializeOAuthReconnectManager = require('./services/initializeOAuthReconnectManager');
const createValidateImageRequest = require('./middleware/validateImageRequest');
const { jwtLogin, ldapLogin, passportLogin } = require('~/strategies');
const { updateInterfacePermissions } = require('~/models/interface');
const { checkMigrations } = require('./services/start/migration');
const initializeMCPs = require('./services/initializeMCPs');
const configureSocialLogins = require('./socialLogins');
const { getAppConfig } = require('./services/Config');
const staticCache = require('./utils/staticCache');
const noIndex = require('./middleware/noIndex');
const { seedDatabase } = require('~/models');
const routes = require('./routes');
const { User } = require('~/db/models');
const { setAdminId } = require('~/config');

const { PORT, HOST, ALLOW_SOCIAL_LOGIN, DISABLE_COMPRESSION, TRUST_PROXY } = process.env ?? {};

/**
 * Resolve ADMIN_ID from ADMIN_EMAIL once at server startup
 * This eliminates repeated database queries during MCP execution
 * CRITICAL: Server will not start if admin is not found
 */
async function resolveAdminId() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    const error = 'FATAL: ADMIN_EMAIL environment variable not set. Cannot start MCP system.';
    logger.error(error);
    throw new Error(error);
  }

  logger.debug(`[MCP] Looking for admin user with email: ${adminEmail}`);

  const admin = await User.findOne(
    { email: adminEmail },
    '_id'
  ).lean().exec();

  if (!admin) {
    const error = `FATAL: Admin user with email "${adminEmail}" not found in database. Cannot start MCP system.`;
    logger.error(error);
    throw new Error(error);
  }

  const adminId = admin._id.toString();
  setAdminId(adminId);
  logger.info(`[MCP] ✓ Resolved Admin ID: ${adminId}`);
}

// Allow PORT=0 to be used for automatic free port assignment
const port = isNaN(Number(PORT)) ? 3080 : Number(PORT);
const host = HOST || 'localhost';
const trusted_proxy = Number(TRUST_PROXY) || 1; /* trust first proxy by default */

const app = express();

const startServer = async () => {
  if (typeof Bun !== 'undefined') {
    axios.defaults.headers.common['Accept-Encoding'] = 'gzip';
  }
  await connectDb();

  logger.info('Connected to MongoDB');
  indexSync().catch((err) => {
    logger.error('[indexSync] Background sync failed:', err);
  });

  // Resolve ADMIN_ID for MCP execution
  await resolveAdminId();

  app.disable('x-powered-by');
  app.set('trust proxy', trusted_proxy);

  await seedDatabase();
  const appConfig = await getAppConfig();
  initializeFileStorage(appConfig);
  await performStartupChecks(appConfig);
  await updateInterfacePermissions(appConfig);

  const indexPath = path.join(appConfig.paths.dist, 'index.html');
  let indexHTML = fs.readFileSync(indexPath, 'utf8');

  // In order to provide support to serving the application in a sub-directory
  // We need to update the base href if the DOMAIN_CLIENT is specified and not the root path
  if (process.env.DOMAIN_CLIENT) {
    const clientUrl = new URL(process.env.DOMAIN_CLIENT);
    const baseHref = clientUrl.pathname.endsWith('/')
      ? clientUrl.pathname
      : `${clientUrl.pathname}/`;
    if (baseHref !== '/') {
      logger.info(`Setting base href to ${baseHref}`);
      indexHTML = indexHTML.replace(/base href="\/"/, `base href="${baseHref}"`);
    }
  }

  app.get('/health', (_req, res) => res.status(200).send('OK'));

  /* Middleware */
  app.use(noIndex);
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: true, limit: '3mb' }));
  app.use(handleJsonParseError);

  /**
   * Express 5 Compatibility: Make req.query writable for mongoSanitize
   * In Express 5, req.query is read-only by default, but express-mongo-sanitize needs to modify it
   */
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'query', {
      ...Object.getOwnPropertyDescriptor(req, 'query'),
      value: req.query,
      writable: true,
    });
    next();
  });

  app.use(mongoSanitize());
  app.use(cors());
  app.use(cookieParser());

  if (!isEnabled(DISABLE_COMPRESSION)) {
    app.use(compression());
  } else {
    console.warn('Response compression has been disabled via DISABLE_COMPRESSION.');
  }

  app.use(staticCache(appConfig.paths.dist));
  app.use(staticCache(appConfig.paths.fonts));
  app.use(staticCache(appConfig.paths.assets));

  if (!ALLOW_SOCIAL_LOGIN) {
    console.warn('⚠️  Social logins are disabled. Set ALLOW_SOCIAL_LOGIN=true to enable Yandex OAuth.');
  }

  /* OAUTH - Only Yandex enabled */
  app.use(passport.initialize());
  passport.use(jwtLogin());
  // [DISABLED] Email/Password login (passportLogin) - only Yandex OAuth is enabled
  // passport.use(passportLogin());

  /* LDAP Auth */
  if (process.env.LDAP_URL && process.env.LDAP_USER_SEARCH_BASE) {
    passport.use(ldapLogin);
  }

  if (isEnabled(ALLOW_SOCIAL_LOGIN)) {
    await configureSocialLogins(app);
  }

  logger.debug('[app.use] Mounting /oauth', typeof routes.oauth);
  app.use('/oauth', routes.oauth);
  /* API Endpoints */
  logger.debug('[app.use] Mounting /api/auth', typeof routes.auth);
  app.use('/api/auth', routes.auth);
  logger.debug('[app.use] Mounting /api/admin/auth', typeof routes.adminAuth);
  app.use('/api/admin/auth', routes.adminAuth);
  logger.debug('[app.use] Mounting /api/admin/mvp', typeof routes.adminMvp);
  app.use('/api/admin/mvp', routes.adminMvp);
  logger.debug('[app.use] Mounting /api/actions', typeof routes.actions);
  app.use('/api/actions', routes.actions);
  logger.debug('[app.use] Mounting /api/keys', typeof routes.keys);
  app.use('/api/keys', routes.keys);
  logger.debug('[app.use] Mounting /api/api-keys', typeof routes.apiKeys);
  app.use('/api/api-keys', routes.apiKeys);
  logger.debug('[app.use] Mounting /api/user', typeof routes.user);
  app.use('/api/user', routes.user);
  logger.debug('[app.use] Mounting /api/search', typeof routes.search);
  app.use('/api/search', routes.search);
  logger.debug('[app.use] Mounting /api/messages', typeof routes.messages);
  app.use('/api/messages', routes.messages);
  logger.debug('[app.use] Mounting /api/convos', typeof routes.convos);
  app.use('/api/convos', routes.convos);
  logger.debug('[app.use] Mounting /api/presets', typeof routes.presets);
  app.use('/api/presets', routes.presets);
  logger.debug('[app.use] Mounting /api/prompts', typeof routes.prompts);
  app.use('/api/prompts', routes.prompts);
  logger.debug('[app.use] Mounting /api/categories', typeof routes.categories);
  app.use('/api/categories', routes.categories);
  logger.debug('[app.use] Mounting /api/endpoints', typeof routes.endpoints);
  app.use('/api/endpoints', routes.endpoints);
  logger.debug('[app.use] Mounting /api/balance', typeof routes.balance);
  app.use('/api/balance', routes.balance);
  logger.debug('[app.use] Mounting /api/models', typeof routes.models);
  app.use('/api/models', routes.models);
  logger.debug('[app.use] Mounting /api/payment', typeof routes.payment);
  app.use('/api/payment', routes.payment);
  logger.debug('[app.use] Mounting /api/user/subscription', typeof routes.subscription);
  app.use('/api/user/subscription', routes.subscription);
  logger.debug('[app.use] Mounting /api/config', typeof routes.config);
  app.use('/api/config', routes.config);
  logger.debug('[app.use] Mounting /api/assistants', typeof routes.assistants);
  app.use('/api/assistants', routes.assistants);
  logger.debug('[app.use] Mounting /api/files (after initialize)');
  app.use('/api/files', await routes.files.initialize());
  logger.debug('[app.use] Mounting /images/');

  // Check staticRoute before using
  if (typeof routes.staticRoute !== 'function' && typeof routes.staticRoute?.use !== 'function') {
    throw new Error('❌ CRITICAL: routes.staticRoute is not a valid middleware! Type: ' + typeof routes.staticRoute);
  }

  app.use('/images/', createValidateImageRequest(appConfig.secureImageLinks), routes.staticRoute);
  logger.debug('[app.use] Mounting /api/share', typeof routes.share);
  app.use('/api/share', routes.share);
  logger.debug('[app.use] Mounting /api/roles', typeof routes.roles);
  app.use('/api/roles', routes.roles);
  logger.debug('[app.use] Mounting /api/agents', typeof routes.agents);
  app.use('/api/agents', routes.agents);
  logger.debug('[app.use] Mounting /api/banner', typeof routes.banner);
  app.use('/api/banner', routes.banner);
  logger.debug('[app.use] Mounting /api/memories', typeof routes.memories);
  app.use('/api/memories', routes.memories);
  logger.debug('[app.use] Mounting /api/permissions', typeof routes.accessPermissions);
  app.use('/api/permissions', routes.accessPermissions);

  logger.debug('[app.use] Mounting /api/tags', typeof routes.tags);
  app.use('/api/tags', routes.tags);
  logger.debug('[app.use] Mounting /api/mcp', typeof routes.mcp);
  app.use('/api/mcp', routes.mcp);
  logger.debug('[app.use] Mounting /api/settings', typeof routes.settings);
  app.use('/api/settings', routes.settings);

  /** 404 for unmatched API routes */
  app.use('/api', apiNotFound);

  /** SPA fallback - serve index.html for all unmatched routes */
  app.use((req, res) => {
    res.set({
      'Cache-Control': process.env.INDEX_CACHE_CONTROL || 'no-cache, no-store, must-revalidate',
      Pragma: process.env.INDEX_PRAGMA || 'no-cache',
      Expires: process.env.INDEX_EXPIRES || '0',
    });

    const lang = req.cookies.lang || req.headers['accept-language']?.split(',')[0] || 'en-US';
    const saneLang = lang.replace(/"/g, '&quot;');
    let updatedIndexHtml = indexHTML.replace(/lang="en-US"/g, `lang="${saneLang}"`);

    res.type('html');
    res.send(updatedIndexHtml);
  });

  /** Error handler (must be last - Express identifies error middleware by its 4-arg signature) */
  app.use(ErrorController);

  app.listen(port, host, async (err) => {
    if (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }

    if (host === '0.0.0.0') {
      logger.info(
        `Server listening on all interfaces at port ${port}. Use http://localhost:${port} to access it`,
      );
    } else {
      logger.info(`Server listening at http://${host == '0.0.0.0' ? 'localhost' : host}:${port}`);
    }

    await initializeMCPs();
    await initializeOAuthReconnectManager();
    await checkMigrations();

    // Configure stream services (auto-detects Redis from USE_REDIS env var)
    const streamServices = createStreamServices();
    GenerationJobManager.configure(streamServices);
    GenerationJobManager.initialize();

    const inspectFlags = process.execArgv.some((arg) => arg.startsWith('--inspect'));
    if (inspectFlags || isEnabled(process.env.MEM_DIAG)) {
      memoryDiagnostics.start();
    }
  });
};

startServer();

let messageCount = 0;
process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    logger.error('There was an uncaught error:', err);
  }

  if (err.message && err.message?.toLowerCase()?.includes('abort')) {
    logger.warn('There was an uncatchable abort error.');
    return;
  }

  if (err.message.includes('GoogleGenerativeAI')) {
    logger.warn(
      '\n\n`GoogleGenerativeAI` errors cannot be caught due to an upstream issue, see: https://github.com/google-gemini/generative-ai-js/issues/303',
    );
    return;
  }

  if (err.message.includes('fetch failed')) {
    if (messageCount === 0) {
      logger.warn('Meilisearch error, search will be disabled');
      messageCount++;
    }

    return;
  }

  if (err.message.includes('OpenAIError') || err.message.includes('ChatCompletionMessage')) {
    logger.error(
      '\n\nAn Uncaught `OpenAIError` error may be due to your reverse-proxy setup or stream configuration, or a bug in the `openai` node package.',
    );
    return;
  }

  if (err.stack && err.stack.includes('@librechat/agents')) {
    logger.error(
      '\n\nAn error occurred in the agents system. The error has been logged and the app will continue running.',
      {
        message: err.message,
        stack: err.stack,
      },
    );
    return;
  }

  if (isEnabled(process.env.CONTINUE_ON_UNCAUGHT_EXCEPTION)) {
    logger.error('Unhandled error encountered. The app will continue running.', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
    return;
  }

  process.exit(1);
});

/** Export app for easier testing purposes */
module.exports = app;
