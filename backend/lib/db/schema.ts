import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'context-os.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH, { timeout: 5000 });

try {
  db.pragma('journal_mode = WAL');
} catch (error) {
  console.warn('Failed to enable WAL mode:', error);
}
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Password reset column upgrades - add columns if they don't exist
  try {
    // Get table info to check if columns exist
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const columnNames = tableInfo.map(row => row.name);

    if (!columnNames.includes('reset_token')) {
      // Add column without UNIQUE constraint first
      db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT`);
      // Then create unique index
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`);
    }
    if (!columnNames.includes('reset_token_expires_at')) {
      db.exec(`ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME`);
    }
  } catch (e) {
    // Ignore errors during column addition (may fail in some SQLite versions)
    console.log('Note: Could not add password reset columns:', e);
  }

  // Knowledge bases table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_content TEXT,
      mime_type TEXT,
      file_size INTEGER,
      status TEXT DEFAULT 'queued',
      error_message TEXT,
      ktype_summary TEXT,
      ktype_metadata TEXT,
      deep_summary TEXT,
      chunk_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Documents column upgrades
  try {
    db.exec(`ALTER TABLE documents ADD COLUMN file_content TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: file_content column may already exist');
    }
  }

  // Document-notebook link table
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_notebooks (
      doc_id TEXT NOT NULL,
      kb_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (doc_id, kb_id),
      FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Backfill document-notebook links
  db.exec(`
    INSERT OR IGNORE INTO document_notebooks (doc_id, kb_id, user_id, created_at)
    SELECT id, kb_id, user_id, created_at FROM documents;
  `);

  // Notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      note_type TEXT,
      is_shared BOOLEAN DEFAULT 0,
      share_token TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Quick notes table (saved chat-based quick notes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS quick_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Notes column upgrades
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN title TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: title column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN note_type TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: note_type column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN is_shared BOOLEAN DEFAULT 0`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: is_shared column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN share_token TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: share_token column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: created_at column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: updated_at column may already exist');
    }
  }

  // Quick notes column upgrades
  try {
    db.exec(`ALTER TABLE quick_notes ADD COLUMN label TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: quick_notes label column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE quick_notes ADD COLUMN content TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: quick_notes content column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE quick_notes ADD COLUMN file_name TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: quick_notes file_name column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE quick_notes ADD COLUMN storage_path TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: quick_notes storage_path column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE quick_notes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: quick_notes created_at column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE quick_notes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: quick_notes updated_at column may already exist');
    }
  }

  // Chat sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Chat sessions column upgrades
  try {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN summary TEXT`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: summary column may already exist');
    }
  }
  try {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.includes('duplicate column')) {
      console.log('Note: updated_at column may already exist');
    }
  }

  // Chat messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `);

  // Chat message feedback table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_message_feedback (
      id TEXT PRIMARY KEY,
      message_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      rating TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id),
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Document shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME,
      access_count INTEGER DEFAULT 0,
      permissions TEXT DEFAULT 'view',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Document comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_comments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_documents_kb ON documents(kb_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_document_notebooks_kb ON document_notebooks(kb_id);
    CREATE INDEX IF NOT EXISTS idx_document_notebooks_doc ON document_notebooks(doc_id);
    CREATE INDEX IF NOT EXISTS idx_document_notebooks_user ON document_notebooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_share ON notes(share_token) WHERE is_shared = 1;
    CREATE INDEX IF NOT EXISTS idx_quick_notes_user ON quick_notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_quick_notes_updated ON quick_notes(updated_at);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(token);
    CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_comments_user ON document_comments(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_message_feedback_message ON chat_message_feedback(message_id);
    CREATE INDEX IF NOT EXISTS idx_chat_message_feedback_user ON chat_message_feedback(user_id);
  `);

  // Knowledge base shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base_shares (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME,
      access_count INTEGER DEFAULT 0,
      permissions TEXT DEFAULT 'chat',
      revoked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_kb_shares_token ON knowledge_base_shares(token);
    CREATE INDEX IF NOT EXISTS idx_kb_shares_kb ON knowledge_base_shares(kb_id);
    CREATE INDEX IF NOT EXISTS idx_kb_shares_user ON knowledge_base_shares(user_id);
  `);

  console.log('Database initialized successfully');
}

initializeDatabase();
