import Database from 'better-sqlite3';

const db = new Database('./data/context-os.db');

console.log('=== Documents for KB e6499217-e24b-46f5-805b-ea994ec27aaa ===');
const docs = db.prepare('SELECT * FROM documents WHERE kb_id = ?').all('e6499217-e24b-46f5-805b-ea994ec27aaa');
for (const doc of docs) {
  console.log('ID:', doc.id);
  console.log('File:', doc.file_name);
  console.log('Status:', doc.status);
  console.log('Chunks:', doc.chunk_count);
  console.log('Created:', doc.created_at);
  console.log('Updated:', doc.updated_at);
  console.log('');
}

console.log('=== All documents with status queued ===');
const queued = db.prepare('SELECT id, file_name, kb_id, status FROM documents WHERE status = ?').all('queued');
for (const doc of queued) {
  console.log('-', doc.id.slice(0,8) + '...', doc.file_name, '| kb:', doc.kb_id.slice(0,8) + '...');
}

db.close();
