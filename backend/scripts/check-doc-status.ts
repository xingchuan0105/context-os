import { db } from '../lib/db/schema';

const docs = db.prepare(`
  SELECT id, kb_id, file_name, status,
         ktype_summary IS NOT NULL as has_ktype,
         chunk_count
  FROM documents
  WHERE file_name LIKE '%test.pdf%'
  ORDER BY created_at DESC
  LIMIT 5
`).all() as any[];

console.log('\n📄 Recent test.pdf documents:\n');
docs.forEach((doc, index) => {
  console.log(`[${index + 1}] Document ID: ${doc.id}`);
  console.log(`    KB ID: ${doc.kb_id}`);
  console.log(`    File: ${doc.file_name}`);
  console.log(`    Status: ${doc.status}`);
  console.log(`    Has K-Type: ${doc.has_ktype ? '✅ Yes' : '�� No'}`);
  console.log(`    Chunks: ${doc.chunk_count || 0}`);
  console.log('');
});

if (docs.length === 0) {
  console.log('No test.pdf documents found in database.');
}
