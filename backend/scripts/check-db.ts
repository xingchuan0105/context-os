import Database from 'better-sqlite3'

const db = new Database('./data/context-os.db')

// Get table schema
const schema = db.prepare('PRAGMA table_info(documents)').all()
console.log('Documents table schema:')
console.table(schema)

// Get row count
const count = db.prepare('SELECT COUNT(*) as count FROM documents').get()
console.log('\nTotal documents:', count)

// Get some documents
const docs = db.prepare('SELECT * FROM documents LIMIT 5').all()
console.log('\nSample documents:')
console.table(docs)

db.close()
