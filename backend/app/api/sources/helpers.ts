import { base64ToText } from '@/lib/storage/local'
import { Document } from '@/lib/db/queries'
import { enqueueDocumentIngest } from '@/lib/queue'
import { extractContentFromMarkdown } from '@/lib/utils/markdown'

type SourceAsset = {
  file_path?: string
  url?: string
}

const readMetadataValue = (markdown: string, key: string): string | null => {
  const pattern = new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, 'i')
  const match = markdown.match(pattern)
  if (!match) return null
  return match[1].trim()
}

export const extractSourceMetadata = (base64: string | null) => {
  if (!base64) return { sourceType: null, sourceUrl: null }
  try {
    const markdown = base64ToText(base64)
    return {
      sourceType: readMetadataValue(markdown, 'source_type'),
      sourceUrl: readMetadataValue(markdown, 'source_url'),
    }
  } catch {
    return { sourceType: null, sourceUrl: null }
  }
}

export { extractContentFromMarkdown }

export const mapDocumentToSource = (doc: Document) => {
  const { sourceType, sourceUrl } = extractSourceMetadata(doc.file_content)
  const normalizedType = sourceType ? sourceType.toLowerCase() : null
  let asset: SourceAsset | null = null

  if (normalizedType === 'link' && sourceUrl) {
    asset = { url: sourceUrl }
  } else if (normalizedType === 'text') {
    asset = null
  } else if (doc.storage_path) {
    asset = { file_path: doc.storage_path }
  }

  return {
    id: doc.id,
    title: doc.file_name,
    asset,
    embedded: doc.status === 'completed',
    embedded_chunks: doc.chunk_count ?? 0,
    insights_count: 0,
    created: doc.created_at,
    updated: doc.created_at,
    file_available: Boolean(doc.storage_path),
    status: doc.status,
    processing_info: doc.error_message ? { error: doc.error_message } : undefined,
  }
}

export const mapDocumentToSourceDetail = (doc: Document, notebookIds?: string[]) => {
  let fullText = ''
  if (doc.file_content) {
    try {
      fullText = base64ToText(doc.file_content)
    } catch {
      fullText = ''
    }
  }

  return {
    ...mapDocumentToSource(doc),
    full_text: fullText,
    notebooks: notebookIds && notebookIds.length > 0 ? notebookIds : [doc.kb_id],
  }
}

export const processDocumentInBackground = async (docId: string) => {
  await enqueueDocumentIngest(docId)
}
