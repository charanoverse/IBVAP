import { app } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { storageManager } from './storage/index.js';
import { initializeDatabase } from './repositories/initDb.js';
import { aiProcessManager } from './ai/AIProcessManager.js';
import { aiDetectionService } from './services/aiDetectionService.js';

async function startServer(): Promise<void> {
  try {
    logger.info('Initializing IBVAP Backend...');

    // 1. Ensure local storage directories exist
    storageManager.ensureDirectories();

    // 2. Initialize Database & run schema migrations
    await initializeDatabase();

    // 3. Start AI Process Manager (Phase 3)
    if (config.ai.enabled) {
      aiProcessManager.start().catch((err) => {
        logger.warn('AI Process Manager encountered startup issue, running in fallback mode:', err);
      });
    }

    // 4. Start HTTP Server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`========================================================`);
      logger.info(`IBVAP Backend running at http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check: http://${config.host}:${config.port}/api/health`);
      logger.info(`AI Subsystem: http://${config.host}:${config.port}/api/detections/ai/status`);
      logger.info(`========================================================`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down server gracefully...`);
      aiDetectionService.stop();
      await aiProcessManager.stop();
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start IBVAP backend', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

