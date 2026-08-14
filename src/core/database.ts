import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { encrypt, isEncrypted } from './crypto-utils.js'

const DATA_DIR = path.resolve('data')
const DB_PATH = path.join(DATA_DIR, 'qwenproxy.db')

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)

  // Enable WAL mode for better concurrent read performance (ideal for VPS)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -64000') // 64MB cache
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  migrateFromJson(db)
  encryptPlaintextPasswords(db)

  return db
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      api_key TEXT UNIQUE NOT NULL,
      rate_limit_rpm INTEGER NOT NULL DEFAULT 0,
      max_concurrency INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

    CREATE TABLE IF NOT EXISTS sessions (
      session_key TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      headers TEXT NOT NULL DEFAULT '{}',
      parent_id TEXT,
      history_complete INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON sessions(chat_id);
  `)

  try {
    db.exec(`ALTER TABLE accounts ADD COLUMN cooldown_until INTEGER DEFAULT 0;`)
  } catch { /* column may already exist */ }
  try {
    db.exec(`ALTER TABLE accounts ADD COLUMN cooldown_reason TEXT;`)
  } catch { /* column may already exist */ }
}

function encryptPlaintextPasswords(db: Database.Database): void {
  const rows = db.prepare('SELECT id, password FROM accounts').all() as Array<{ id: string; password: string }>
  const update = db.prepare('UPDATE accounts SET password = ? WHERE id = ?')
  let migrated = 0

  const migrate = db.transaction(() => {
    for (const row of rows) {
      if (row.password && !isEncrypted(row.password)) {
        update.run(encrypt(row.password), row.id)
        migrated++
      }
    }
  })

  migrate()

  if (migrated > 0) {
    console.log(`[Database] Encrypted ${migrated} plaintext password(s) in database`)
  }
}

/**
 * Auto-migrate existing accounts.json into SQLite on first run.
 * The JSON file is renamed to accounts.json.bak after successful migration.
 */
function migrateFromJson(db: Database.Database): void {
  const jsonPath = path.resolve('accounts.json')
  if (!fs.existsSync(jsonPath)) return

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const accounts = JSON.parse(raw) as Array<{ id: string; email: string; password: string }>

    if (!Array.isArray(accounts) || accounts.length === 0) {
      // Empty or invalid file — just rename it
      fs.renameSync(jsonPath, jsonPath + '.bak')
      return
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO accounts (id, email, password) VALUES (?, ?, ?)
    `)

    const migrate = db.transaction(() => {
      for (const account of accounts) {
        if (account.id && typeof account.email === 'string' && account.email.trim().length > 0) {
          insert.run(account.id, account.email.trim(), account.password || '')
        }
      }
    })

    migrate()

    // Rename old file to .bak to avoid re-migration
    fs.renameSync(jsonPath, jsonPath + '.bak')
    console.log(`[Database] Migrated ${accounts.length} account(s) from accounts.json to SQLite`)
  } catch (err: any) {
    console.error('[Database] Failed to migrate accounts.json:', err.message)
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// --- Users (per-user API keys, quotas) --------------------------------------

export interface UserRow {
  id: string
  email: string | null
  api_key: string
  rate_limit_rpm: number
  max_concurrency: number
}

export function getUserByApiKey(apiKey: string): UserRow | null {
  const row = getDatabase()
    .prepare('SELECT id, email, api_key, rate_limit_rpm, max_concurrency FROM users WHERE api_key = ?')
    .get(apiKey) as UserRow | undefined
  return row ?? null
}

export function getUserById(id: string): UserRow | null {
  const row = getDatabase()
    .prepare('SELECT id, email, api_key, rate_limit_rpm, max_concurrency FROM users WHERE id = ?')
    .get(id) as UserRow | undefined
  return row ?? null
}

export function listUsers(): UserRow[] {
  return getDatabase()
    .prepare('SELECT id, email, api_key, rate_limit_rpm, max_concurrency FROM users ORDER BY created_at ASC')
    .all() as UserRow[]
}

export function upsertUser(entry: {
  id: string
  email?: string | null
  apiKey: string
  rateLimitRpm?: number
  maxConcurrency?: number
}): void {
  getDatabase()
    .prepare(`
      INSERT INTO users (id, email, api_key, rate_limit_rpm, max_concurrency, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        api_key = excluded.api_key,
        rate_limit_rpm = excluded.rate_limit_rpm,
        max_concurrency = excluded.max_concurrency,
        updated_at = datetime('now')
    `)
    .run(entry.id, entry.email ?? null, entry.apiKey, entry.rateLimitRpm ?? 0, entry.maxConcurrency ?? 0)
}

export function deleteUserById(id: string): void {
  getDatabase().prepare('DELETE FROM users WHERE id = ?').run(id)
}

// --- Sessions (persistent server-side conversation pins) ---------------------

export interface SessionRow {
  session_key: string
  chat_id: string
  account_id: string
  headers: string
  parent_id: string | null
  history_complete: number
  updated_at: number
}

export function listSessions(): SessionRow[] {
  return getDatabase().prepare('SELECT session_key, chat_id, account_id, headers, parent_id, history_complete, updated_at FROM sessions').all() as SessionRow[]
}

export function upsertSession(row: SessionRow): void {
  getDatabase()
    .prepare(`
      INSERT INTO sessions (session_key, chat_id, account_id, headers, parent_id, history_complete, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        chat_id = excluded.chat_id,
        account_id = excluded.account_id,
        headers = excluded.headers,
        parent_id = excluded.parent_id,
        history_complete = excluded.history_complete,
        updated_at = excluded.updated_at
    `)
    .run(row.session_key, row.chat_id, row.account_id, row.headers, row.parent_id, row.history_complete, row.updated_at)
}

export function deleteSession(sessionKey: string): void {
  getDatabase().prepare('DELETE FROM sessions WHERE session_key = ?').run(sessionKey)
}
