import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AIProcessManager {
  private process: ChildProcess | null = null;
  private isShuttingDown = false;
  private isReady = false;
  private retryCount = 0;
  private maxRetries = 5;

  public async start(): Promise<void> {
    if (!config.ai.enabled) {
      logger.info('AI Object Detection Subsystem is disabled via configuration (AI_ENABLED=false).');
      return;
    }

    const scriptPath = path.resolve(__dirname, '../../../ai/detection/service.py');
    const pythonExe = config.ai.pythonPath || 'python';

    logger.info(`Starting Python AI Detection Subsystem on port ${config.ai.servicePort}...`);

    const env = {
      ...process.env,
      AI_SERVICE_PORT: config.ai.servicePort.toString(),
      AI_MODEL_PATH: config.ai.modelPath,
      AI_CONFIDENCE_THRESHOLD: config.ai.confidenceThreshold.toString(),
      AI_IOU_THRESHOLD: config.ai.iouThreshold.toString(),
      AI_INFERENCE_FPS: config.ai.inferenceFps.toString(),
      AI_DEVICE: config.ai.device,
      AI_CLASSES: config.ai.targetClasses.join(','),
      STORAGE_VIDEOS_PATH: config.storage.videosPath,
      PYTHONUNBUFFERED: '1',
    };

    try {
      this.process = spawn(
        pythonExe,
        [
          scriptPath,
          '--port', config.ai.servicePort.toString(),
          '--model', config.ai.modelPath,
          '--conf', config.ai.confidenceThreshold.toString(),
          '--iou', config.ai.iouThreshold.toString(),
          '--fps', config.ai.inferenceFps.toString(),
          '--device', config.ai.device,
          '--videos-dir', config.storage.videosPath,
        ],
        { env, stdio: ['ignore', 'pipe', 'pipe'] }
      );

      this.process.stdout?.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) {
          logger.info(`[Python AI] ${msg}`);
        }
      });

      this.process.stderr?.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) {
          // Filter common non-error library notes
          if (msg.includes('Ultralytics') || msg.includes('YOLO') || msg.includes('torch')) {
            logger.info(`[Python AI] ${msg}`);
          } else {
            logger.warn(`[Python AI stderr] ${msg}`);
          }
        }
      });

      this.process.on('exit', (code, signal) => {
        this.isReady = false;
        if (!this.isShuttingDown) {
          logger.warn(`Python AI service exited unexpectedly with code ${code}, signal ${signal}`);
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            logger.info(`Attempting to restart AI service (attempt ${this.retryCount}/${this.maxRetries})...`);
            setTimeout(() => this.start(), 2000);
          }
        }
      });

      // Wait for health check confirmation
      await this.waitForHealth(8000);
      this.isReady = true;
      logger.info('Python AI Detection Subsystem is ONLINE and ready.');
    } catch (err) {
      logger.error('Failed to spawn Python AI Subsystem process:', err);
    }
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    if (this.process) {
      logger.info('Stopping Python AI Subsystem process...');
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.isReady = false;
  }

  public isServiceReady(): boolean {
    return this.isReady;
  }

  private waitForHealth(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        const req = http.get(`http://127.0.0.1:${config.ai.servicePort}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else if (Date.now() - startTime < timeoutMs) {
            setTimeout(check, 500);
          } else {
            resolve(false);
          }
        });

        req.on('error', () => {
          if (Date.now() - startTime < timeoutMs) {
            setTimeout(check, 500);
          } else {
            logger.warn('Timed out waiting for AI service HTTP health check.');
            resolve(false);
          }
        });

        req.end();
      };

      check();
    });
  }
}

export const aiProcessManager = new AIProcessManager();
