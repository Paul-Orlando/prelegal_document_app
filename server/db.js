import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config.js';

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spec_id     TEXT,
    title       TEXT NOT NULL,
    values_json TEXT NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'draft',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_document ON messages(document_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

/* ------------------------------------------------------------------ users */

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function createUser({ email, displayName, password }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: id(),
    email: email.toLowerCase().trim(),
    display_name: displayName.trim(),
    password_hash: hashPassword(password, salt),
    password_salt: salt,
    created_at: now(),
  };
  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, password_salt, created_at)
     VALUES (@id, @email, @display_name, @password_hash, @password_salt, @created_at)`,
  ).run(user);
  return { id: user.id, email: user.email, displayName: user.display_name };
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
}

export function verifyPassword(user, password) {
  const candidate = hashPassword(password, user.password_salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.password_hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* --------------------------------------------------------------- sessions */

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(token, userId, now(), new Date(Date.now() + SESSION_TTL_MS).toISOString());
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.display_name AS displayName, s.expires_at AS expiresAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  return { id: row.id, email: row.email, displayName: row.displayName };
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/* -------------------------------------------------------------- documents */

export function createDocument(userId, { specId = null, title = 'Untitled document' } = {}) {
  const doc = {
    id: id(),
    user_id: userId,
    spec_id: specId,
    title,
    values_json: '{}',
    status: 'draft',
    created_at: now(),
    updated_at: now(),
  };
  db.prepare(
    `INSERT INTO documents (id, user_id, spec_id, title, values_json, status, created_at, updated_at)
     VALUES (@id, @user_id, @spec_id, @title, @values_json, @status, @created_at, @updated_at)`,
  ).run(doc);
  return toDocument(doc);
}

function toDocument(row) {
  if (!row) return null;
  let values = {};
  try {
    values = JSON.parse(row.values_json);
  } catch {
    values = {};
  }
  return {
    id: row.id,
    userId: row.user_id,
    specId: row.spec_id,
    title: row.title,
    values,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDocument(userId, documentId) {
  return toDocument(
    db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(documentId, userId),
  );
}

export function listDocuments(userId) {
  return db
    .prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId)
    .map(toDocument);
}

export function updateDocument(userId, documentId, patch) {
  const current = getDocument(userId, documentId);
  if (!current) return null;

  const next = {
    spec_id: patch.specId !== undefined ? patch.specId : current.specId,
    title: patch.title !== undefined ? patch.title : current.title,
    values_json: JSON.stringify(patch.values !== undefined ? patch.values : current.values),
    status: patch.status !== undefined ? patch.status : current.status,
    updated_at: now(),
  };
  db.prepare(
    `UPDATE documents
     SET spec_id = @spec_id, title = @title, values_json = @values_json,
         status = @status, updated_at = @updated_at
     WHERE id = @id AND user_id = @user_id`,
  ).run({ ...next, id: documentId, user_id: userId });

  return getDocument(userId, documentId);
}

export function deleteDocument(userId, documentId) {
  return db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(documentId, userId)
    .changes > 0;
}

/* --------------------------------------------------------------- messages */

export function addMessage(documentId, role, content) {
  const message = { id: id(), document_id: documentId, role, content, created_at: now() };
  db.prepare(
    `INSERT INTO messages (id, document_id, role, content, created_at)
     VALUES (@id, @document_id, @role, @content, @created_at)`,
  ).run(message);
  return { id: message.id, role, content, createdAt: message.created_at };
}

export function listMessages(documentId) {
  return db
    .prepare('SELECT id, role, content, created_at AS createdAt FROM messages WHERE document_id = ? ORDER BY created_at, rowid')
    .all(documentId);
}
