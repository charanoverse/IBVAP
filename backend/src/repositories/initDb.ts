import fs from 'fs';
import path from 'path';
import { db } from './database.js';
import { cameraRepository } from './cameraRepository.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { Camera } from '@ibvap/shared';

export async function initializeDatabase(): Promise<void> {
  logger.info('Starting database initialization...');
  await db.connect();
  await db.initializeSchema();

  // Seed or sync demo cameras from configuration
  const demoCamerasFile = path.resolve(config.configPaths.camerasPath, 'demo_cameras.json');
  if (fs.existsSync(demoCamerasFile)) {
    try {
      const content = fs.readFileSync(demoCamerasFile, 'utf8');
      const parsed = JSON.parse(content) as { cameras?: Camera[] };
      if (parsed.cameras && Array.isArray(parsed.cameras)) {
        for (const cam of parsed.cameras) {
          const existing = await cameraRepository.findById(cam.id);
          if (!existing) {
            await cameraRepository.create(cam);
            logger.info(`Seeded camera: ${cam.id} (${cam.name})`);
          } else {
            await cameraRepository.update(cam.id, cam);
          }
        }
        logger.info(`Synced ${parsed.cameras.length} cameras from config.`);
      }
    } catch (err) {
      logger.warn('Failed to parse or seed demo cameras config', err);
    }
  }

  logger.info('Database initialization completed.');
}

// Allow direct execution via tsx/node
if (process.argv[1]?.endsWith('initDb.ts') || process.argv[1]?.endsWith('initDb.js')) {
  initializeDatabase()
    .then(async () => {
      await db.close();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error('Database initialization failed', err);
      await db.close();
      process.exit(1);
    });
}
