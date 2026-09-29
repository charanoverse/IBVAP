import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { SCHEMA_SQL } from './schema.js';

export class Database {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || config.databasePath;
  }

  public async connect(): Promise<sqlite3.Database> {
    if (this.db) {
      return this.db;
    }

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error(`Failed to connect to SQLite database at ${this.dbPath}`, err);
          return reject(err);
        }
        logger.info(`SQLite connected at ${this.dbPath}`);
        // Enable foreign keys
        this.db?.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
          if (pragmaErr) {
            logger.warn('Failed to enable foreign keys pragma', pragmaErr);
          }
          resolve(this.db!);
        });
      });
    });
  }

  public async initializeSchema(): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      // 1. Run base DDL
      db.exec(SCHEMA_SQL, async (err) => {
        try {
          const runAlter = (sql: string): Promise<void> =>
            new Promise((res) => {
              db.run(sql, () => res());
            });

          // Check events table columns
          const eventCols = (await new Promise<any[]>((res) => db.all('PRAGMA table_info(events);', (_, rows) => res(rows || [])))) || [];
          const eventColNames = new Set(eventCols.map((c) => c.name));

          if (!eventColNames.has('status')) await runAlter("ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'VERIFIED'");
          if (!eventColNames.has('rule_id')) await runAlter('ALTER TABLE events ADD COLUMN rule_id TEXT');
          if (!eventColNames.has('rule_name')) await runAlter('ALTER TABLE events ADD COLUMN rule_name TEXT');
          if (!eventColNames.has('line_id')) await runAlter('ALTER TABLE events ADD COLUMN line_id TEXT');
          if (!eventColNames.has('track_id')) await runAlter('ALTER TABLE events ADD COLUMN track_id INTEGER');
          if (!eventColNames.has('track_display_id')) await runAlter('ALTER TABLE events ADD COLUMN track_display_id TEXT');
          if (!eventColNames.has('object_class')) await runAlter('ALTER TABLE events ADD COLUMN object_class TEXT');
          if (!eventColNames.has('confidence')) await runAlter('ALTER TABLE events ADD COLUMN confidence REAL');
          if (!eventColNames.has('started_at')) await runAlter('ALTER TABLE events ADD COLUMN started_at TEXT');
          if (!eventColNames.has('verified_at')) await runAlter('ALTER TABLE events ADD COLUMN verified_at TEXT');
          if (!eventColNames.has('ended_at')) await runAlter('ALTER TABLE events ADD COLUMN ended_at TEXT');
          if (!eventColNames.has('video_timestamp')) await runAlter('ALTER TABLE events ADD COLUMN video_timestamp REAL');
          if (!eventColNames.has('explanation')) await runAlter('ALTER TABLE events ADD COLUMN explanation TEXT');
          if (!eventColNames.has('metadata_json')) await runAlter("ALTER TABLE events ADD COLUMN metadata_json TEXT DEFAULT '{}'");

          // Check incidents table columns
          const incCols = (await new Promise<any[]>((res) => db.all('PRAGMA table_info(incidents);', (_, rows) => res(rows || [])))) || [];
          const incColNames = new Set(incCols.map((c) => c.name));

          if (!incColNames.has('title')) await runAlter("ALTER TABLE incidents ADD COLUMN title TEXT NOT NULL DEFAULT ''");
          if (!incColNames.has('camera_id')) await runAlter('ALTER TABLE incidents ADD COLUMN camera_id TEXT');
          if (!incColNames.has('camera_name')) await runAlter('ALTER TABLE incidents ADD COLUMN camera_name TEXT');
          if (!incColNames.has('zone_id')) await runAlter('ALTER TABLE incidents ADD COLUMN zone_id TEXT');
          if (!incColNames.has('zone_name')) await runAlter('ALTER TABLE incidents ADD COLUMN zone_name TEXT');
          if (!incColNames.has('line_id')) await runAlter('ALTER TABLE incidents ADD COLUMN line_id TEXT');
          if (!incColNames.has('line_name')) await runAlter('ALTER TABLE incidents ADD COLUMN line_name TEXT');
          if (!incColNames.has('primary_event_id')) await runAlter("ALTER TABLE incidents ADD COLUMN primary_event_id TEXT NOT NULL DEFAULT ''");
          if (!incColNames.has('priority_reason')) await runAlter("ALTER TABLE incidents ADD COLUMN priority_reason TEXT NOT NULL DEFAULT ''");
          if (!incColNames.has('state')) await runAlter("ALTER TABLE incidents ADD COLUMN state TEXT NOT NULL DEFAULT 'NEW'");
          if (!incColNames.has('opened_at')) await runAlter("ALTER TABLE incidents ADD COLUMN opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
          if (!incColNames.has('acknowledged_at')) await runAlter('ALTER TABLE incidents ADD COLUMN acknowledged_at TEXT');
          if (!incColNames.has('acknowledged_by')) await runAlter('ALTER TABLE incidents ADD COLUMN acknowledged_by TEXT');
          if (!incColNames.has('review_started_at')) await runAlter('ALTER TABLE incidents ADD COLUMN review_started_at TEXT');
          if (!incColNames.has('review_started_by')) await runAlter('ALTER TABLE incidents ADD COLUMN review_started_by TEXT');
          if (!incColNames.has('escalated_at')) await runAlter('ALTER TABLE incidents ADD COLUMN escalated_at TEXT');
          if (!incColNames.has('escalated_by')) await runAlter('ALTER TABLE incidents ADD COLUMN escalated_by TEXT');
          if (!incColNames.has('closed_at')) await runAlter('ALTER TABLE incidents ADD COLUMN closed_at TEXT');
          if (!incColNames.has('closed_by')) await runAlter('ALTER TABLE incidents ADD COLUMN closed_by TEXT');
          if (!incColNames.has('outcome')) await runAlter('ALTER TABLE incidents ADD COLUMN outcome TEXT');
          if (!incColNames.has('operator_notes')) await runAlter('ALTER TABLE incidents ADD COLUMN operator_notes TEXT');
          if (!incColNames.has('notes_json')) await runAlter("ALTER TABLE incidents ADD COLUMN notes_json TEXT NOT NULL DEFAULT '[]'");
          if (!incColNames.has('evidence_state')) await runAlter("ALTER TABLE incidents ADD COLUMN evidence_state TEXT NOT NULL DEFAULT 'PENDING'");
          if (!incColNames.has('explanation')) await runAlter('ALTER TABLE incidents ADD COLUMN explanation TEXT');
          if (!incColNames.has('track_id')) await runAlter('ALTER TABLE incidents ADD COLUMN track_id INTEGER');
          if (!incColNames.has('track_display_id')) await runAlter('ALTER TABLE incidents ADD COLUMN track_display_id TEXT');
          if (!incColNames.has('object_class')) await runAlter('ALTER TABLE incidents ADD COLUMN object_class TEXT');
          if (!incColNames.has('observation_quality')) await runAlter("ALTER TABLE incidents ADD COLUMN observation_quality TEXT NOT NULL DEFAULT 'GOOD'");
          if (!incColNames.has('processing_session_id')) await runAlter('ALTER TABLE incidents ADD COLUMN processing_session_id TEXT');

          // Check evidence table columns
          const evdCols = (await new Promise<any[]>((res) => db.all('PRAGMA table_info(evidence);', (_, rows) => res(rows || [])))) || [];
          const evdColNames = new Set(evdCols.map((c) => c.name));

          if (!evdColNames.has('incident_id')) await runAlter('ALTER TABLE evidence ADD COLUMN incident_id TEXT');
          if (!evdColNames.has('primary_event_id')) await runAlter('ALTER TABLE evidence ADD COLUMN primary_event_id TEXT');
          if (!evdColNames.has('linked_events_json')) await runAlter("ALTER TABLE evidence ADD COLUMN linked_events_json TEXT NOT NULL DEFAULT '[]'");
          if (!evdColNames.has('pre_event_clip')) await runAlter('ALTER TABLE evidence ADD COLUMN pre_event_clip TEXT');
          if (!evdColNames.has('event_clip')) await runAlter('ALTER TABLE evidence ADD COLUMN event_clip TEXT');
          if (!evdColNames.has('post_event_clip')) await runAlter('ALTER TABLE evidence ADD COLUMN post_event_clip TEXT');
          if (!evdColNames.has('hashes_json')) await runAlter("ALTER TABLE evidence ADD COLUMN hashes_json TEXT NOT NULL DEFAULT '{}'");
          if (!evdColNames.has('status')) await runAlter("ALTER TABLE evidence ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'");
          if (!evdColNames.has('error_message')) await runAlter('ALTER TABLE evidence ADD COLUMN error_message TEXT');
          if (!evdColNames.has('timestamps_json')) await runAlter("ALTER TABLE evidence ADD COLUMN timestamps_json TEXT NOT NULL DEFAULT '{}'");
          if (!evdColNames.has('manifest_json')) await runAlter('ALTER TABLE evidence ADD COLUMN manifest_json TEXT');
          if (!evdColNames.has('updated_at')) await runAlter("ALTER TABLE evidence ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");

          // Check correlations table columns (Phase 7)
          const corrCols = (await new Promise<any[]>((res) => db.all('PRAGMA table_info(correlations);', (_, rows) => res(rows || [])))) || [];
          const corrColNames = new Set(corrCols.map((c) => c.name));

          if (!corrColNames.has('source_camera_id')) await runAlter("ALTER TABLE correlations ADD COLUMN source_camera_id TEXT NOT NULL DEFAULT ''");
          if (!corrColNames.has('target_camera_id')) await runAlter("ALTER TABLE correlations ADD COLUMN target_camera_id TEXT NOT NULL DEFAULT ''");
          if (!corrColNames.has('relationship_type')) await runAlter("ALTER TABLE correlations ADD COLUMN relationship_type TEXT NOT NULL DEFAULT ''");
          if (!corrColNames.has('time_delta_seconds')) await runAlter("ALTER TABLE correlations ADD COLUMN time_delta_seconds REAL NOT NULL DEFAULT 0.0");
          if (!corrColNames.has('score')) await runAlter("ALTER TABLE correlations ADD COLUMN score REAL NOT NULL DEFAULT 0.0");
          if (!corrColNames.has('factors_json')) await runAlter("ALTER TABLE correlations ADD COLUMN factors_json TEXT NOT NULL DEFAULT '{}'");
          if (!corrColNames.has('explanation')) await runAlter("ALTER TABLE correlations ADD COLUMN explanation TEXT NOT NULL DEFAULT ''");
          if (!corrColNames.has('reviewed_at')) await runAlter('ALTER TABLE correlations ADD COLUMN reviewed_at TEXT');
          if (!corrColNames.has('reviewed_by')) await runAlter('ALTER TABLE correlations ADD COLUMN reviewed_by TEXT');
          if (!corrColNames.has('review_note')) await runAlter('ALTER TABLE correlations ADD COLUMN review_note TEXT');

          // Phase 8: Camera Health Transitions Table
          await new Promise<void>((res, rej) => {
            db.run(`
              CREATE TABLE IF NOT EXISTS camera_health_transitions (
                id TEXT PRIMARY KEY,
                camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
                previous_state TEXT NOT NULL,
                new_state TEXT NOT NULL,
                previous_visibility TEXT,
                new_visibility TEXT,
                reason TEXT NOT NULL,
                is_simulated INTEGER NOT NULL DEFAULT 0,
                timestamp TEXT NOT NULL
              );
            `, (err) => {
              if (err) rej(err); else res();
            });
          });
          await new Promise<void>((res) => {
            db.run(`CREATE INDEX IF NOT EXISTS idx_health_transitions_cam ON camera_health_transitions(camera_id, timestamp);`, () => res());
          });

          logger.info('Database schema initialized and verified successfully.');
          resolve();
        } catch (mErr) {
          logger.error('Error during database schema verification:', mErr);
          resolve();
        }
      });
    });
  }

  public async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows as T[]);
      });
    });
  }

  public async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row as T | undefined);
      });
    });
  }

  public async run(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          return reject(err);
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  public async clearAllTables(): Promise<void> {
    const db = await this.connect();
    const tables = [
      'audit_logs',
      'sync_records',
      'evidence',
      'correlations',
      'incidents',
      'events',
      'detections',
      'observations',
      'cameras',
    ];
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('PRAGMA foreign_keys = OFF;');
        for (const table of tables) {
          db.run(`DELETE FROM ${table};`);
        }
        db.run('PRAGMA foreign_keys = ON;', (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  public async close(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          logger.error('Error closing SQLite database', err);
          return reject(err);
        }
        this.db = null;
        logger.info('SQLite database closed.');
        resolve();
      });
    });
  }
}

export const db = new Database();
