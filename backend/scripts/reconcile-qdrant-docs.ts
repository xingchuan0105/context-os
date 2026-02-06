import { db } from '../lib/db/schema'
import {
  deleteDocumentChunks,
  getDocumentLayers,
  getUserClient,
  getUserCollectionName,
} from '../lib/qdrant'

type DocPayload = {
  doc_id?: string
  kb_id?: string
  user_id?: string
  content?: string
  metadata?: {
    file_name?: string
  }
}

const getArg = (name: string): string | undefined => {
  const idx = process.argv.indexOf(name)
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined
  return process.argv[idx + 1]
}

const userId = getArg('--user-id') || process.env.USER_ID
const kbId = getArg('--kb-id') || process.env.KB_ID
const mode = (getArg('--mode') || process.env.MODE || 'backfill').toLowerCase()

if (!userId) {
  console.error('Usage: tsx scripts/reconcile-qdrant-docs.ts --user-id <id> [--kb-id <id>] [--mode backfill|delete-orphans]')
  process.exit(1)
}

if (mode !== 'backfill' && mode !== 'delete-orphans') {
  console.error(`Unknown mode: ${mode}. Use backfill or delete-orphans.`)
  process.exit(1)
}

const normalizeFileName = (payload: DocPayload) => {
  const name = payload.metadata?.file_name?.trim()
  if (name) return name
  const docId = payload.doc_id || 'unknown'
  return `doc_${docId}.md`
}

const inferMimeType = (fileName: string) => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.md')) return 'text/markdown'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return null
}

const hasDocumentStmt = db.prepare('SELECT id, kb_id, user_id FROM documents WHERE id = ?')
const hasLinkStmt = db.prepare(
  'SELECT 1 FROM document_notebooks WHERE doc_id = ? AND kb_id = ? AND user_id = ?'
)
const insertDocStmt = db.prepare(
  `INSERT INTO documents (
    id, kb_id, user_id, file_name, storage_path, file_content,
    mime_type, file_size, status, error_message,
    ktype_summary, ktype_metadata, deep_summary, chunk_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
)
const insertLinkStmt = db.prepare(
  'INSERT OR IGNORE INTO document_notebooks (doc_id, kb_id, user_id) VALUES (?, ?, ?)'
)

const main = async () => {
  const client = getUserClient(userId)
  const collectionName = getUserCollectionName(userId)

  const must: Array<{ key: string; match: { value: string } }> = [
    { key: 'type', match: { value: 'document' } },
  ]
  if (kbId) {
    must.push({ key: 'kb_id', match: { value: kbId } })
  }

  const docs: DocPayload[] = []
  let offset: string | number | undefined

  do {
    const result = await client.scroll(collectionName, {
      filter: { must },
      limit: 256,
      with_payload: true,
      with_vector: false,
      offset,
    })
    for (const point of result.points || []) {
      const payload = point.payload as DocPayload | undefined
      if (!payload?.doc_id) continue
      docs.push(payload)
    }
    offset = result.next_page_offset ?? undefined
  } while (offset !== undefined)

  if (docs.length === 0) {
    console.log('No qdrant documents found for reconciliation.')
    return
  }

  let created = 0
  let linked = 0
  let deleted = 0
  let skipped = 0

  for (const payload of docs) {
    const docId = payload.doc_id
    const payloadKbId = payload.kb_id
    const payloadUserId = payload.user_id
    if (!docId || !payloadKbId || !payloadUserId) {
      skipped += 1
      continue
    }

    if (payloadUserId !== userId) {
      skipped += 1
      continue
    }

    const existing = hasDocumentStmt.get(docId) as { id: string; kb_id: string; user_id: string } | undefined

    if (!existing) {
      if (mode === 'delete-orphans') {
        await deleteDocumentChunks(userId, docId)
        deleted += 1
        continue
      }

      const fileName = normalizeFileName(payload)
      const mimeType = inferMimeType(fileName)
      const summary = (payload.content || '').trim() || null
      let chunkCount = 0
      try {
        const layers = await getDocumentLayers(userId, docId)
        chunkCount = layers.children.length
      } catch {
        chunkCount = 0
      }

      insertDocStmt.run(
        docId,
        payloadKbId,
        payloadUserId,
        fileName,
        '',
        null,
        mimeType,
        null,
        'completed',
        null,
        summary,
        null,
        summary,
        chunkCount
      )
      insertLinkStmt.run(docId, payloadKbId, payloadUserId)
      created += 1
      continue
    }

    const link = hasLinkStmt.get(docId, payloadKbId, payloadUserId)
    if (!link) {
      insertLinkStmt.run(docId, payloadKbId, payloadUserId)
      linked += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        mode,
        total: docs.length,
        created,
        linked,
        deleted,
        skipped,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('Reconcile failed:', error)
  process.exit(1)
})
