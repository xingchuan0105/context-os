import Database from 'better-sqlite3';

const db = new Database('./data/context-os.db');

console.log('=== Knowledge Bases ===');
const kbs = db.prepare('SELECT id, title, user_id, created_at FROM knowledge_bases WHERE user_id = ?').all('823590bf-83ad-4140-a263-c9bc6b3fda1e');
for (const kb of kbs) {
  console.log('KB:', kb.id);
  console.log('  Title:', kb.title);
  console.log('  Created:', kb.created_at);

  // Count documents
  const docs = db.prepare('SELECT id, file_name, status, chunk_count FROM documents WHERE kb_id = ?').all(kb.id);
  console.log('  Documents:', docs.length);
  for (const doc of docs) {
    console.log('    -', doc.file_name, '| status:', doc.status, '| chunks:', doc.chunk_count);
  }
  console.log('');
}

console.log('=== Chat Sessions ===');
const sessions = db.prepare('SELECT id, title, kb_id FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5').all('823590bf-83ad-4140-a263-c9bc6b3fda1e');
for (const s of sessions) {
  console.log('Session:', s.id);
  console.log('  Title:', s.title);
  console.log('  KB ID:', s.kb_id);
  console.log('');
}

db.close();
