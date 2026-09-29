import { config } from '../config/index.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  private currentPriority: number;

  constructor() {
    this.currentPriority = LOG_LEVEL_PRIORITY[config.logLevel] ?? 1;
  }

  private formatMessage(level: LogLevel, message: string, context?: unknown): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;
    if (context !== undefined) {
      if (context instanceof Error) {
        formatted += `\n  Error: ${context.message}\n  Stack: ${context.stack}`;
      } else if (typeof context === 'object') {
        try {
          formatted += ` ${JSON.stringify(context)}`;
        } catch {
          formatted += ` [Unserializable Object]`;
        }
      } else {
        formatted += ` ${String(context)}`;
      }
    }
    return formatted;
  }

  debug(message: string, context?: unknown): void {
    if (this.currentPriority <= LOG_LEVEL_PRIORITY.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: unknown): void {
    if (this.currentPriority <= LOG_LEVEL_PRIORITY.INFO) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: unknown): void {
    if (this.currentPriority <= LOG_LEVEL_PRIORITY.WARN) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, context?: unknown): void {
    if (this.currentPriority <= LOG_LEVEL_PRIORITY.ERROR) {
      console.error(this.formatMessage('ERROR', message, context));
    }
  }
}

export const logger = new Logger();
