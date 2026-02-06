import { db } from './schema';
import { v4 as uuidv4 } from 'uuid';

// ==================== 知识库相关 ====================

export interface KnowledgeBase {
  id: string;
  user_id: string;
  title: string;
  icon: string | null;
  description: string | null;
  created_at: string;
}

export async function getKnowledgeBasesByUserId(userId: string): Promise<KnowledgeBase[]> {
  const stmt = db.prepare(
    'SELECT id, user_id, title, icon, description, created_at FROM knowledge_bases WHERE user_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(userId) as KnowledgeBase[];
}

export async function getKnowledgeBaseById(kbId: string): Promise<KnowledgeBase | null> {
  const stmt = db.prepare(
    'SELECT id, user_id, title, icon, description, created_at FROM knowledge_bases WHERE id = ?'
  );
  return stmt.get(kbId) as KnowledgeBase | null;
}

export async function createKnowledgeBase(
  userId: string,
  title: string,
  icon?: string,
  description?: string
): Promise<KnowledgeBase> {
  const id = uuidv4();
  const stmt = db.prepare(
    `INSERT INTO knowledge_bases (id, user_id, title, icon, description)
     VALUES (?, ?, ?, ?, ?)`
  );
  stmt.run(id, userId, title, icon || null, description || null);

  const created = await getKnowledgeBaseById(id);
  if (!created) throw new Error('Failed to create knowledge base');
  return created;
}

export async function deleteKnowledgeBase(kbId: string, userId: string): Promise<boolean> {
  const stmt = db.prepare(
    'DELETE FROM knowledge_bases WHERE id = ? AND user_id = ?'
  );
  const result = stmt.run(kbId, userId);
  return result.changes > 0;
}

// ==================== 文档相关 ====================

export interface Document {
  id: string;
  kb_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  file_content: string | null;
  mime_type: string | null;
  file_size: number | null;
  status: string;
  error_message: string | null;
  ktype_summary: string | null;
  ktype_metadata: string | null;
  deep_summary: string | null;
  chunk_count: number;
  created_at: string;
}

type DocumentListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'created_at';
  order?: 'asc' | 'desc';
};

const resolveDocumentOrder = (options?: DocumentListOptions) => {
  const orderBy = options?.orderBy === 'created_at' ? 'created_at' : 'created_at';
  const order = options?.order === 'asc' ? 'ASC' : 'DESC';
  return { orderBy, order };
};

export async function getDocumentsByKbId(kbId: string): Promise<Document[]> {
  const stmt = db.prepare(
    `SELECT id, kb_id, user_id, file_name, storage_path, file_content, mime_type, file_size,
            status, error_message, ktype_summary, ktype_metadata, deep_summary,
            chunk_count, created_at
     FROM documents WHERE kb_id = ?
     ORDER BY created_at DESC`
  );
  return stmt.all(kbId) as Document[];
}

export async function getDocumentsByNotebookId(
  kbId: string,
  options?: DocumentListOptions
): Promise<Document[]> {
  const { orderBy, order } = resolveDocumentOrder(options);
  const limit = typeof options?.limit === 'number' ? options.limit : null;
  const offset = typeof options?.offset === 'number' ? options.offset : null;
  const limitClause = limit !== null ? 'LIMIT ?' : offset !== null ? 'LIMIT -1' : '';
  const offsetClause = offset !== null ? 'OFFSET ?' : '';
  const sql = `
    SELECT d.id, d.kb_id, d.user_id, d.file_name, d.storage_path, d.file_content, d.mime_type, d.file_size,
           d.status, d.error_message, d.ktype_summary, d.ktype_metadata, d.deep_summary,
           d.chunk_count, d.created_at
    FROM documents d
    INNER JOIN document_notebooks dn ON dn.doc_id = d.id
    WHERE dn.kb_id = ?
    ORDER BY d.${orderBy} ${order}
    ${limitClause}
    ${offsetClause}
  `;
  const stmt = db.prepare(sql);
  const params: Array<string | number> = [kbId];
  if (limit !== null) params.push(limit);
  if (offset !== null) params.push(offset);
  return stmt.all(...params) as Document[];
}

export async function getDocumentsByUserId(
  userId: string,
  options?: DocumentListOptions
): Promise<Document[]> {
  const { orderBy, order } = resolveDocumentOrder(options);
  const limit = typeof options?.limit === 'number' ? options.limit : null;
  const offset = typeof options?.offset === 'number' ? options.offset : null;
  const limitClause = limit !== null ? 'LIMIT ?' : offset !== null ? 'LIMIT -1' : '';
  const offsetClause = offset !== null ? 'OFFSET ?' : '';
  const sql = `
    SELECT DISTINCT d.id, d.kb_id, d.user_id, d.file_name, d.storage_path, d.file_content, d.mime_type, d.file_size,
           d.status, d.error_message, d.ktype_summary, d.ktype_metadata, d.deep_summary,
           d.chunk_count, d.created_at
    FROM documents d
    INNER JOIN document_notebooks dn ON dn.doc_id = d.id
    WHERE d.user_id = ?
    ORDER BY d.${orderBy} ${order}
    ${limitClause}
    ${offsetClause}
  `;
  const stmt = db.prepare(sql);
  const params: Array<string | number> = [userId];
  if (limit !== null) params.push(limit);
  if (offset !== null) params.push(offset);
  return stmt.all(...params) as Document[];
}

export async function getNotebookIdsByDocumentId(docId: string): Promise<string[]> {
  const stmt = db.prepare(
    'SELECT kb_id FROM document_notebooks WHERE doc_id = ? ORDER BY created_at DESC'
  );
  const rows = stmt.all(docId) as Array<{ kb_id: string }>;
  return rows.map((row) => row.kb_id);
}

export async function filterDocumentIdsByNotebook(
  docIds: string[],
  kbId: string,
  userId: string
): Promise<string[]> {
  if (!docIds.length) return [];
  const uniqueDocIds = Array.from(new Set(docIds));
  const placeholders = uniqueDocIds.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT doc_id
     FROM document_notebooks
     WHERE kb_id = ? AND user_id = ? AND doc_id IN (${placeholders})`
  );
  const rows = stmt.all(kbId, userId, ...uniqueDocIds) as Array<{ doc_id: string }>;
  return rows.map((row) => row.doc_id);
}

export async function addDocumentNotebookLink(
  docId: string,
  kbId: string,
  userId: string
): Promise<boolean> {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO document_notebooks (doc_id, kb_id, user_id)
     VALUES (?, ?, ?)`
  );
  const result = stmt.run(docId, kbId, userId);
  return result.changes > 0;
}

export async function removeDocumentNotebookLink(
  docId: string,
  kbId: string,
  userId: string
): Promise<boolean> {
  const stmt = db.prepare(
    'DELETE FROM document_notebooks WHERE doc_id = ? AND kb_id = ? AND user_id = ?'
  );
  const result = stmt.run(docId, kbId, userId);
  return result.changes > 0;
}

export async function countDocumentNotebookLinks(docId: string): Promise<number> {
  const stmt = db.prepare(
    'SELECT COUNT(1) as count FROM document_notebooks WHERE doc_id = ?'
  );
  const row = stmt.get(docId) as { count: number } | undefined;
  return row?.count ?? 0;
}

export async function getDocumentById(docId: string): Promise<Document | null> {
  const stmt = db.prepare(
    `SELECT id, kb_id, user_id, file_name, storage_path, file_content, mime_type, file_size,
            status, error_message, ktype_summary, ktype_metadata, deep_summary,
            chunk_count, created_at
     FROM documents WHERE id = ?`
  );
  return stmt.get(docId) as Document | null;
}

export async function createDocument(
  kbId: string,
  userId: string,
  fileName: string,
  storagePath: string,
  fileContent?: string | null,
  mimeType?: string,
  fileSize?: number
): Promise<Document> {
  const id = uuidv4();
  const stmt = db.prepare(
    `INSERT INTO documents (id, kb_id, user_id, file_name, storage_path, file_content, mime_type, file_size, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`
  );
  stmt.run(id, kbId, userId, fileName, storagePath, fileContent || null, mimeType || null, fileSize || null);

  db.prepare(
    `INSERT OR IGNORE INTO document_notebooks (doc_id, kb_id, user_id)
     VALUES (?, ?, ?)`
  ).run(id, kbId, userId);

  const created = await getDocumentById(id);
  if (!created) throw new Error('Failed to create document');
  return created;
}

export async function updateDocumentStatus(
  docId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<boolean> {
  const stmt = db.prepare(
    'UPDATE documents SET status = ?, error_message = ? WHERE id = ?'
  );
  const result = stmt.run(status, errorMessage || null, docId);
  return result.changes > 0;
}

export async function resetDocumentProcessing(docId: string): Promise<boolean> {
  const stmt = db.prepare(
    `UPDATE documents
     SET status = 'processing',
         error_message = NULL,
         ktype_summary = NULL,
         ktype_metadata = NULL,
         deep_summary = NULL,
         chunk_count = NULL
     WHERE id = ?`
  );
  const result = stmt.run(docId);
  return result.changes > 0;
}

export async function updateDocumentKType(
  docId: string,
  ktypeSummary: string,
  ktypeMetadata: string,
  deepSummary: string,
  chunkCount: number
): Promise<boolean> {
  const stmt = db.prepare(
    `UPDATE documents
     SET ktype_summary = ?, ktype_metadata = ?, deep_summary = ?, chunk_count = ?, status = 'completed'
     WHERE id = ?`
  );
  const result = stmt.run(ktypeSummary, ktypeMetadata, deepSummary, chunkCount, docId);
  return result.changes > 0;
}

export async function deleteDocument(docId: string, userId: string): Promise<boolean> {
  const stmt = db.prepare(
    'DELETE FROM documents WHERE id = ? AND user_id = ?'
  );
  const result = stmt.run(docId, userId);
  return result.changes > 0;
}

// ==================== 笔记相关 ====================

export interface Note {
  id: string;
  kb_id: string;
  user_id: string;
  content: string;
  is_shared: number;
  share_token: string | null;
  updated_at: string;
}

export async function getNotesByKbId(kbId: string): Promise<Note[]> {
  const stmt = db.prepare(
    `SELECT id, kb_id, user_id, content, is_shared, share_token, updated_at
     FROM notes WHERE kb_id = ?
     ORDER BY updated_at DESC`
  );
  return stmt.all(kbId) as Note[];
}

export async function createNote(
  kbId: string,
  userId: string,
  content: string
): Promise<Note> {
  const id = uuidv4();
  const stmt = db.prepare(
    `INSERT INTO notes (id, kb_id, user_id, content)
     VALUES (?, ?, ?, ?)`
  );
  stmt.run(id, kbId, userId, content);

  const notes = await getNotesByKbId(kbId);
  const created = notes.find(n => n.id === id);
  if (!created) throw new Error('Failed to create note');
  return created;
}

export async function updateNote(
  noteId: string,
  userId: string,
  content: string
): Promise<boolean> {
  const stmt = db.prepare(
    `UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`
  );
  const result = stmt.run(content, noteId, userId);
  return result.changes > 0;
}

export async function deleteNote(noteId: string, userId: string): Promise<boolean> {
  const stmt = db.prepare(
    'DELETE FROM notes WHERE id = ? AND user_id = ?'
  );
  const result = stmt.run(noteId, userId);
  return result.changes > 0;
}

// ==================== 随手记（Quick Notes） ====================

export interface QuickNote {
  id: string;
  user_id: string;
  label: string;
  content: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

export async function getQuickNotesByUserId(userId: string): Promise<QuickNote[]> {
  const stmt = db.prepare(
    `SELECT id, user_id, label, content, file_name, storage_path, created_at, updated_at
     FROM quick_notes
     WHERE user_id = ?
     ORDER BY updated_at DESC`
  );
  return stmt.all(userId) as QuickNote[];
}

export async function getQuickNoteById(noteId: string): Promise<QuickNote | null> {
  const stmt = db.prepare(
    `SELECT id, user_id, label, content, file_name, storage_path, created_at, updated_at
     FROM quick_notes
     WHERE id = ?`
  );
  return stmt.get(noteId) as QuickNote | null;
}

export async function getQuickNoteByIdForUser(
  noteId: string,
  userId: string
): Promise<QuickNote | null> {
  const stmt = db.prepare(
    `SELECT id, user_id, label, content, file_name, storage_path, created_at, updated_at
     FROM quick_notes
     WHERE id = ? AND user_id = ?`
  );
  return stmt.get(noteId, userId) as QuickNote | null;
}

export async function createQuickNote(
  userId: string,
  label: string,
  content: string,
  fileName: string,
  storagePath: string
): Promise<QuickNote> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO quick_notes (id, user_id, label, content, file_name, storage_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(id, userId, label, content, fileName, storagePath, now, now);

  const created = await getQuickNoteById(id);
  if (!created) throw new Error('Failed to create quick note');
  return created;
}

export async function deleteQuickNote(noteId: string, userId: string): Promise<boolean> {
  const stmt = db.prepare(
    'DELETE FROM quick_notes WHERE id = ? AND user_id = ?'
  );
  const result = stmt.run(noteId, userId);
  return result.changes > 0;
}

// ==================== 聊天会话相关 ====================

export interface ChatSession {
  id: string;
  kb_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: string | null;
  created_at: string;
}

export async function getChatSessionsByKbId(kbId: string): Promise<ChatSession[]> {
  const stmt = db.prepare(
    'SELECT id, kb_id, user_id, title, created_at FROM chat_sessions WHERE kb_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(kbId) as ChatSession[];
}

export async function createChatSession(
  kbId: string,
  userId: string,
  title?: string
): Promise<ChatSession> {
  const id = uuidv4();
  const stmt = db.prepare(
    `INSERT INTO chat_sessions (id, kb_id, user_id, title)
     VALUES (?, ?, ?, ?)`
  );
  stmt.run(id, kbId, userId, title || null);

  const sessions = await getChatSessionsByKbId(kbId);
  const created = sessions.find(s => s.id === id);
  if (!created) throw new Error('Failed to create chat session');
  return created;
}

export async function getChatMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
  const stmt = db.prepare(
    `SELECT id, session_id, role, content, citations, created_at
     FROM chat_messages WHERE session_id = ?
     ORDER BY created_at ASC`
  );
  return stmt.all(sessionId) as ChatMessage[];
}

export async function createChatMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  citations?: string
): Promise<ChatMessage> {
  const stmt = db.prepare(
    `INSERT INTO chat_messages (session_id, role, content, citations)
     VALUES (?, ?, ?, ?)`
  );
  stmt.run(sessionId, role, content, citations || null);

  const messages = await getChatMessagesBySessionId(sessionId);
  const created = messages[messages.length - 1];
  if (!created) throw new Error('Failed to create chat message');
  return created;
}

export async function deleteChatSession(sessionId: string, userId: string): Promise<boolean> {
  const stmt = db.prepare(
    'DELETE FROM chat_sessions WHERE id = ? AND user_id = ?'
  );
  const result = stmt.run(sessionId, userId);
  return result.changes > 0;
}

// ==================== share related ====================

// ==================== knowledge base share ====================

export interface KnowledgeBaseShare {
  id: string;
  kb_id: string;
  user_id: string;
  token: string;
  expires_at: string | null;
  access_count: number;
  permissions: string;
  revoked_at: string | null;
  created_at: string;
}

export async function createKnowledgeBaseShare(
  kbId: string,
  userId: string,
  expiresAt: Date | null,
  permissions: string = 'chat'
): Promise<KnowledgeBaseShare> {
  const id = uuidv4();
  const token = uuidv4().replace(/-/g, '');

  const stmt = db.prepare(
    `INSERT INTO knowledge_base_shares (id, kb_id, user_id, token, expires_at, permissions)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(id, kbId, userId, token, expiresAt?.toISOString() || null, permissions);

  const created = await getKnowledgeBaseShareByToken(token);
  if (!created) throw new Error('Failed to create knowledge base share');
  return created;
}

export async function getKnowledgeBaseShareByToken(token: string): Promise<KnowledgeBaseShare | null> {
  const stmt = db.prepare(
    'SELECT * FROM knowledge_base_shares WHERE token = ?'
  );
  const share = stmt.get(token) as KnowledgeBaseShare | null;

  if (!share) {
    return null;
  }

  if (share.revoked_at) {
    return null;
  }

  if (share.expires_at) {
    const expiresAt = new Date(share.expires_at);
    if (expiresAt < new Date()) {
      return null;
    }
  }

  return share;
}

export async function getKnowledgeBaseSharesByKbId(kbId: string): Promise<KnowledgeBaseShare[]> {
  const stmt = db.prepare(
    'SELECT * FROM knowledge_base_shares WHERE kb_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(kbId) as KnowledgeBaseShare[];
}

export async function incrementKnowledgeBaseShareAccessCount(token: string): Promise<void> {
  const stmt = db.prepare(
    'UPDATE knowledge_base_shares SET access_count = access_count + 1 WHERE token = ?'
  );
  stmt.run(token);
}

export async function revokeKnowledgeBaseShare(
  shareId: string,
  kbId: string,
  userId: string
): Promise<boolean> {
  const stmt = db.prepare(
    `UPDATE knowledge_base_shares
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = ? AND kb_id = ? AND user_id = ?`
  );
  const result = stmt.run(shareId, kbId, userId);
  return result.changes > 0;
}

// ==================== document share ====================

export interface DocumentShare {
  id: string;
  document_id: string;
  user_id: string;
  token: string;
  expires_at: string | null;
  access_count: number;
  permissions: string;
  created_at: string;
}

export async function createDocumentShare(
  documentId: string,
  userId: string,
  expiresAt: Date | null,
  permissions: string = 'view'
): Promise<DocumentShare> {
  const id = uuidv4();
  const token = uuidv4().replace(/-/g, ''); // 简化的 token

  const stmt = db.prepare(
    `INSERT INTO document_shares (id, document_id, user_id, token, expires_at, permissions)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(id, documentId, userId, token, expiresAt?.toISOString() || null, permissions);

  const created = await getDocumentShareByToken(token);
  if (!created) throw new Error('Failed to create document share');
  return created;
}

export async function getDocumentShareByToken(token: string): Promise<DocumentShare | null> {
  const stmt = db.prepare(
    'SELECT * FROM document_shares WHERE token = ?'
  );
  const share = stmt.get(token) as DocumentShare | null;

  // 检查是否过期
  if (share && share.expires_at) {
    const expiresAt = new Date(share.expires_at);
    if (expiresAt < new Date()) {
      return null;
    }
  }

  return share;
}

export async function getDocumentSharesByDocumentId(documentId: string): Promise<DocumentShare[]> {
  const stmt = db.prepare(
    'SELECT * FROM document_shares WHERE document_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(documentId) as DocumentShare[];
}

export async function incrementShareAccessCount(token: string): Promise<void> {
  const stmt = db.prepare(
    'UPDATE document_shares SET access_count = access_count + 1 WHERE token = ?'
  );
  stmt.run(token);
}

export async function deleteDocumentShare(shareId: string): Promise<boolean> {
  const stmt = db.prepare('DELETE FROM document_shares WHERE id = ?');
  const result = stmt.run(shareId);
  return result.changes > 0;
}

// ==================== 文档评论相关 ====================

export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentCommentWithUser extends DocumentComment {
  username: string;
  email: string;
}

export async function createDocumentComment(
  documentId: string,
  userId: string,
  content: string
): Promise<DocumentComment> {
  const id = uuidv4();

  const stmt = db.prepare(
    `INSERT INTO document_comments (id, document_id, user_id, content)
     VALUES (?, ?, ?, ?)`
  );
  stmt.run(id, documentId, userId, content);

  const created = await getDocumentCommentById(id);
  if (!created) throw new Error('Failed to create comment');
  return created;
}

export async function getDocumentCommentById(commentId: string): Promise<DocumentComment | null> {
  const stmt = db.prepare(
    'SELECT * FROM document_comments WHERE id = ?'
  );
  return stmt.get(commentId) as DocumentComment | null;
}

export async function getCommentsByDocumentId(documentId: string): Promise<DocumentCommentWithUser[]> {
  const stmt = db.prepare(`
    SELECT c.*, u.email,
      COALESCE(u.full_name, u.email) as username
    FROM document_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.document_id = ?
    ORDER BY c.created_at DESC
  `);
  return stmt.all(documentId) as DocumentCommentWithUser[];
}

export async function deleteDocumentComment(commentId: string, userId: string): Promise<boolean> {
  const stmt = db.prepare(
    'DELETE FROM document_comments WHERE id = ? AND user_id = ?'
  );
  const result = stmt.run(commentId, userId);
  return result.changes > 0;
}
