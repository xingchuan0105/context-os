import { createIngestWorker, type IngestJobData } from './queue'
import { getDocumentById, updateDocumentStatus } from './db/queries'
import { base64ToText } from './storage/local'
import { extractContentFromMarkdown } from './utils/markdown'
import { processDocument, processDocumentWithText } from './processors/document-processor'

export const ingestWorker = createIngestWorker(async (job) => {
  const { docId } = job.data as IngestJobData
  const doc = await getDocumentById(docId)

  if (!doc) {
    throw new Error(`Document not found: ${docId}`)
  }

  await updateDocumentStatus(doc.id, 'processing')

  try {
    let extractedText = ''

    if (doc.file_content) {
      try {
        const markdown = base64ToText(doc.file_content)
        extractedText = extractContentFromMarkdown(markdown)
      } catch {
        extractedText = ''
      }
    }

    if (extractedText.trim()) {
      const result = await processDocumentWithText(doc, extractedText)
      if (!result.success) {
        throw new Error(result.error || 'Document processing failed')
      }
      return
    }

    const result = await processDocument(doc)
    if (!result.success) {
      throw new Error(result.error || 'Document processing failed')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await updateDocumentStatus(doc.id, 'failed', message)
    throw error
  }
})
