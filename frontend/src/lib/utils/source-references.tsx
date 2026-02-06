import React from 'react'
import { FileText, Lightbulb, FileEdit } from 'lucide-react'

export type ReferenceType = 'source' | 'note' | 'source_insight'

export interface ParsedReference {
  type: ReferenceType
  id: string
  originalText: string
  startIndex: number
  endIndex: number
}

export interface ExtractedReference {
  type: ReferenceType
  id: string
  originalText: string
  placeholder: string
}

export interface ExtractedReferences {
  processedText: string
  references: ExtractedReference[]
}

export interface ReferenceData {
  number: number
  type: ReferenceType
  id: string
}

/**
 * Parse source references from text
 *
 * Handles various formats:
 * - [source:abc123] → single reference
 * - [note:a], [note:b] → multiple references
 * - [note:a, note:b] → comma-separated references (edge case from LLM)
 * - Mixed: [source:x, note:y, source_insight:z]
 *
 * @param text - Text containing references
 * @returns Array of parsed references
 */
export function parseSourceReferences(text: string): ParsedReference[] {
  // Match pattern: (source_insight|note|source):alphanumeric_id
  // This handles references both inside and outside brackets
  const pattern = /(source_insight|note|source):([a-zA-Z0-9_]+)/g
  const matches: ParsedReference[] = []

  let match
  while ((match = pattern.exec(text)) !== null) {
    const type = match[1] as ReferenceType
    const id = match[2]

    matches.push({
      type,
      id,
      originalText: match[0],
      startIndex: match.index,
      endIndex: pattern.lastIndex
    })
  }

  return matches
}

/**
 * Convert source references in text to clickable React elements
 *
 * @param text - Text containing references
 * @param onReferenceClick - Callback when reference is clicked (type, id)
 * @returns React nodes with clickable reference buttons
 */
export function convertSourceReferences(
  text: string,
  onReferenceClick: (type: ReferenceType, id: string) => void
): React.ReactNode {
  const matches = parseSourceReferences(text)

  if (matches.length === 0) return text

  const parts: React.ReactNode[] = []
  let lastIndex = 0

  matches.forEach((match, idx) => {
    // Check if there are brackets before the match
    const beforeMatch = text.substring(Math.max(0, match.startIndex - 2), match.startIndex)
    const hasDoubleBracketBefore = beforeMatch === '[['
    const hasSingleBracketBefore = beforeMatch.endsWith('[') && !hasDoubleBracketBefore

    // Determine where to start including text
    let textStartIndex = lastIndex
    if (hasDoubleBracketBefore && lastIndex === match.startIndex - 2) {
      textStartIndex = match.startIndex - 2
    } else if (hasSingleBracketBefore && lastIndex === match.startIndex - 1) {
      textStartIndex = match.startIndex - 1
    }

    // Add text before match (excluding brackets we'll include in the button)
    if (textStartIndex < match.startIndex && lastIndex < textStartIndex) {
      parts.push(text.substring(lastIndex, textStartIndex))
    } else if (lastIndex < match.startIndex && !hasSingleBracketBefore && !hasDoubleBracketBefore) {
      parts.push(text.substring(lastIndex, match.startIndex))
    }

    // Check if there are brackets after the match
    const afterMatch = text.substring(match.endIndex, Math.min(text.length, match.endIndex + 2))
    const hasDoubleBracketAfter = afterMatch === ']]'
    const hasSingleBracketAfter = afterMatch.startsWith(']') && !hasDoubleBracketAfter

    // Determine the display text with appropriate brackets
    let displayText = match.originalText
    if (hasDoubleBracketBefore && hasDoubleBracketAfter) {
      displayText = `[[${match.originalText}]]`
    } else if (hasSingleBracketBefore && hasSingleBracketAfter) {
      displayText = `[${match.originalText}]`
    } else {
      displayText = match.originalText
    }

    // Add clickable reference button
    parts.push(
      <button
        key={`ref-${idx}-${match.type}-${match.id}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onReferenceClick(match.type, match.id)
        }}
        className="text-primary hover:underline cursor-pointer inline font-medium"
        type="button"
      >
        {displayText}
      </button>
    )

    // Update lastIndex to skip the closing brackets
    if (hasDoubleBracketAfter) {
      lastIndex = match.endIndex + 2
    } else if (hasSingleBracketAfter) {
      lastIndex = match.endIndex + 1
    } else {
      lastIndex = match.endIndex
    }
  })

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return <>{parts}</>
}

/**
 * Convert references in text to markdown links
 * Use this BEFORE passing text to ReactMarkdown
 *
 * Handles complex patterns including:
 * - Plain references: source:abc → [source:abc](#ref-source-abc)
 * - Bracketed: [source:abc] → [[source:abc]](#ref-source-abc)
 * - Double brackets: [[source:abc]] → [[[source:abc]]](#ref-source-abc)
 * - With bold: [**source:abc**] → [**source:abc**](#ref-source-abc)
 * - After commas: [source:a, note:b] → each converted separately
 * - Nested: [**source:a**, [source_insight:b]] → both converted
 *
 * Uses greedy matching to catch all references regardless of surrounding context.
 *
 * @param text - Original text with references
 * @returns Text with references converted to markdown links
 */
export function convertReferencesToMarkdownLinks(text: string): string {
  // Step 1: Find ALL references using simple greedy pattern
  const refPattern = /(source_insight|note|source):([a-zA-Z0-9_]+)/g
  const references: Array<{ type: string; id: string; index: number; length: number }> = []

  let match
  while ((match = refPattern.exec(text)) !== null) {
    const type = match[1]
    const id = match[2]

    // Validate the reference
    const validTypes = ['source', 'source_insight', 'note']
    if (!validTypes.includes(type) || !id || id.length === 0 || id.length > 100) {
      continue // Skip invalid references
    }

    references.push({
      type,
      id,
      index: match.index,
      length: match[0].length
    })
  }

  // If no references found, return original text
  if (references.length === 0) return text

  // Step 2: Process references from end to start (to preserve indices)
  let result = text
  for (let i = references.length - 1; i >= 0; i--) {
    const ref = references[i]
    const refStart = ref.index
    const refEnd = refStart + ref.length
    const refText = `${ref.type}:${ref.id}`

    // Step 3: Analyze context around the reference
    // Look back up to 50 chars for opening brackets/bold markers
    const contextBefore = result.substring(Math.max(0, refStart - 50), refStart)
    // Look ahead up to 50 chars for closing brackets/bold markers
    const contextAfter = result.substring(refEnd, Math.min(result.length, refEnd + 50))

    // Determine display text by checking immediate surroundings
    let displayText = refText
    let replaceStart = refStart
    let replaceEnd = refEnd

    // Check for double brackets [[ref]]
    if (contextBefore.endsWith('[[') && contextAfter.startsWith(']]')) {
      displayText = `[[${refText}]]`
      replaceStart = refStart - 2
      replaceEnd = refEnd + 2
    }
    // Check for single brackets [ref]
    else if (contextBefore.endsWith('[') && contextAfter.startsWith(']')) {
      displayText = `[${refText}]`
      replaceStart = refStart - 1
      replaceEnd = refEnd + 1
    }
    // Check for bold with brackets [**ref**]
    else if (contextBefore.endsWith('[**') && contextAfter.startsWith('**]')) {
      displayText = `[**${refText}**]`
      replaceStart = refStart - 3
      replaceEnd = refEnd + 3
    }
    // Check for just bold **ref**
    else if (contextBefore.endsWith('**') && contextAfter.startsWith('**')) {
      displayText = `**${refText}**`
      replaceStart = refStart - 2
      replaceEnd = refEnd + 2
    }
    // Plain reference (no brackets)
    else {
      displayText = refText
    }

    // Step 4: Build the markdown link
    const href = `#ref-${ref.type}-${ref.id}`
    const markdownLink = `[${displayText}](${href})`

    // Step 5: Replace in the result string
    result = result.substring(0, replaceStart) + markdownLink + result.substring(replaceEnd)
  }

  return result
}

/**
 * Create a custom link component for ReactMarkdown that handles reference links
 *
 * @param onReferenceClick - Callback for when a reference link is clicked
 * @returns React component for rendering links
 */
export function createReferenceLinkComponent(
  onReferenceClick: (type: ReferenceType, id: string) => void
) {
  const ReferenceLinkComponent = ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href?: string
    children?: React.ReactNode
  }) => {
    // Check if this is a reference link (starts with #ref-)
    if (href?.startsWith('#ref-')) {
      // Parse: #ref-source-abc123 → type=source, id=abc123
      const parts = href.substring(5).split('-') // Remove '#ref-'
      const type = parts[0] as ReferenceType
      const id = parts.slice(1).join('-') // Rejoin in case ID has dashes

      // Select appropriate icon based on reference type
      const IconComponent =
        type === 'source' ? FileText :
        type === 'source_insight' ? Lightbulb :
        FileEdit // note

      return (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onReferenceClick(type, id)
          }}
          className="text-primary hover:underline cursor-pointer inline font-medium"
          type="button"
        >
          <IconComponent className="h-3 w-3 inline mr-1" aria-hidden="true" />
          {children}
        </button>
      )
    }

    // Regular link - open in new tab
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props} className="text-primary hover:underline">
        {children}
      </a>
    )
  }

  ReferenceLinkComponent.displayName = 'ReferenceLinkComponent'
  return ReferenceLinkComponent
}

/**
 * Convert references in text to compact numbered format with reference list
 *
 * This function transforms verbose inline references like [source:abc123] into
 * compact numbered citations [1], [2], etc., and appends a "References:" section
 * at the bottom of the message with the full reference details.
 *
 * Algorithm:
 * 1. Parse all references using parseSourceReferences()
 * 2. Build a reference map to deduplicate and assign numbers
 * 3. Replace inline references with numbered citations
 * 4. Append reference list at the bottom
 *
 * @param text - Original text with references
 * @returns Text with numbered citations and reference list appended
 *
 * @example
 * Input: "See [source:abc] and [note:xyz]. Also [source:abc] again."
 * Output: "See [1] and [2]. Also [1] again.\n\nReferences:\n[1] - [source:abc]\n[2] - [note:xyz]"
 */
export function convertReferencesToCompactMarkdown(text: string): string {
  // Step 1: Parse all references using existing function
  const references = parseSourceReferences(text)

  // Step 2: If no references found, return original text
  if (references.length === 0) {
    return text
  }

  // Step 3: Build reference map (deduplicate and assign numbers)
  const referenceMap = new Map<string, ReferenceData>()
  let nextNumber = 1

  for (const reference of references) {
    const key = `${reference.type}:${reference.id}`
    if (!referenceMap.has(key)) {
      referenceMap.set(key, {
        number: nextNumber++,
        type: reference.type,
        id: reference.id
      })
    }
  }

  // Step 4: Replace references with numbered citations (process from end to start)
  let result = text
  for (let i = references.length - 1; i >= 0; i--) {
    const reference = references[i]
    const key = `${reference.type}:${reference.id}`
    const refData = referenceMap.get(key)!
    const number = refData.number

    // Analyze context around the reference
    const refStart = reference.startIndex
    const refEnd = reference.endIndex
    const contextBefore = result.substring(Math.max(0, refStart - 2), refStart)
    const contextAfter = result.substring(refEnd, Math.min(result.length, refEnd + 2))

    // Determine what to replace based on bracket context
    let replaceStart = refStart
    let replaceEnd = refEnd

    // Check for double brackets [[ref]]
    if (contextBefore === '[[' && contextAfter.startsWith(']]')) {
      replaceStart = refStart - 2
      replaceEnd = refEnd + 2
    }
    // Check for single brackets [ref]
    else if (contextBefore.endsWith('[') && contextAfter.startsWith(']')) {
      replaceStart = refStart - 1
      replaceEnd = refEnd + 1
    }

    // Build the numbered citation with full reference in href
    const citationLink = `[${number}](#ref-${reference.type}-${reference.id})`

    // Replace in the result string
    result = result.substring(0, replaceStart) + citationLink + result.substring(replaceEnd)
  }

  // Step 5: Build reference list
  const refListLines: string[] = ['\n\nReferences:']

  // Iterate through reference map in insertion order (Map preserves order)
  for (const [, refData] of referenceMap) {
    const refListItem = `[${refData.number}] - [${refData.type}:${refData.id}](#ref-${refData.type}-${refData.id})`
    refListLines.push(refListItem)
  }

  // Step 6: Append reference list to result
  result = result + refListLines.join('\n')

  return result
}

/**
 * Create a custom link component for ReactMarkdown that handles compact reference links
 *
 * This component handles two types of reference links:
 * 1. Numbered citations in text: [1](#ref-source-abc123)
 * 2. Reference list items: [source:abc123](#ref-source-abc123)
 *
 * Both use the same href format: #ref-{type}-{id}
 * The component extracts the type and id from the href and triggers the click handler.
 *
 * @param onReferenceClick - Callback for when a reference link is clicked
 * @returns React component for rendering links in ReactMarkdown
 *
 * @example
 * const LinkComponent = createCompactReferenceLinkComponent((type, id) => openModal(type, id))
 * <ReactMarkdown components={{ a: LinkComponent }}>...</ReactMarkdown>
 */
export function createCompactReferenceLinkComponent(
  onReferenceClick: (type: ReferenceType, id: string) => void
) {
  const CompactReferenceLinkComponent = ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href?: string
    children?: React.ReactNode
  }) => {
    // Check if this is a reference link (starts with #ref-)
    if (href?.startsWith('#ref-')) {
      // Parse: #ref-source-abc123 → type=source, id=abc123
      const parts = href.substring(5).split('-') // Remove '#ref-'
      const type = parts[0] as ReferenceType
      const id = parts.slice(1).join('-') // Rejoin in case ID has dashes

      return (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onReferenceClick(type, id)
          }}
          className="text-primary hover:underline cursor-pointer inline font-medium"
          type="button"
        >
          {children}
        </button>
      )
    }

    // Regular link - open in new tab
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props} className="text-primary hover:underline">
        {children}
      </a>
    )
  }

  CompactReferenceLinkComponent.displayName = 'CompactReferenceLinkComponent'
  return CompactReferenceLinkComponent
}

/**
 * 解析后端返回的 [ID: x] Content: 格式
 * 提取 ID 和内容，用于生成悬停卡片
 *
 * @example
 * 输入: "[ID: 1] Content: (doc: abc-123, layer: child) 这是引用内容..."
 * 输出: { citations: [...], plainText: "这是引用内容..." }
 */
export function parseIdCitations(text: string): {
  citations: Array<{
    id: number
    docId: string
    docName: string
    layer: string
    content: string
    startIndex: number
    endIndex: number
  }>
  plainText: string
} {
  // 匹配 [ID: 数字] Content: (doc: xxx, layer: yyy) 内容...
  // 捕获多行内容直到下一个 [ID: 或文本结束
  const pattern = /\[ID:\s*(\d+)\]\s*Content:\s*\([^)]*\)\s*([\s\S]*?)(?=\[ID:\s*\d+\]|$)/g
  const citations: Array<{
    id: number
    docId: string
    docName: string
    layer: string
    content: string
    startIndex: number
    endIndex: number
  }> = []
  let match

  while ((match = pattern.exec(text)) !== null) {
    const id = parseInt(match[1], 10)
    const metadata = match[2]
    const content = match[3] ? match[3].trim() : ''
    const startIndex = match.index
    const endIndex = match.index + match[0].length

    // 解析元数据 (doc: xxx, layer: yyy)
    const docMatch = metadata.match(/doc:\s*([^,)]+)/)
    const layerMatch = metadata.match(/layer:\s*(\w+)/)

    citations.push({
      id,
      docId: docMatch ? docMatch[1].trim() : '',
      docName: docMatch ? docMatch[1].trim() : `doc_${id}`,
      layer: layerMatch ? layerMatch[1].trim() : 'unknown',
      content,
      startIndex,
      endIndex,
    })
  }

  // 移除所有 [ID: x] Content: ... 块，获取纯文本
  const plainText = text.replace(/\[ID:\s*\d+\]\s*Content:\s*[^\[]*(?:\n|$)[^\[]*(?=\[ID:|$)/g, '')

  return { citations, plainText }
}

/**
 * 转换 [ID: x] Content: 格式为数字小标格式
 * 同时返回引用信息供悬停卡片使用
 *
 * @param text - 包含 [ID: x] Content: 格式的文本
 * @returns { processedText, citations }
 */
export function convertIdCitations(text: string) {
  type Citations = ReturnType<typeof parseIdCitations>['citations']
  const { citations, plainText } = parseIdCitations(text)

  // 将 [ID: x] 替换为 markdown 链接格式 [x](#ref-citation-x)
  let processed = plainText
  for (let i = citations.length - 1; i >= 0; i--) {
    const citation = citations[i]
    // 查找并替换 [ID: x] 为 [x](#ref-citation-x)
    const idPattern = new RegExp(`\\[ID:\\s*${citation.id}\\s*\\]`, 'g')
    processed = processed.replace(idPattern, `[${citation.id}](#ref-citation-${citation.id})`)
  }

  return { processedText: processed, citations }
}

/**
 * 将 LLM 输出的 [[ID]] 或 [[ID: x]] 格式转换为 Markdown 链接
 *
 * @param text - 包含 [[1]]、[[ID: 2]]、[[4], [6], [12]] 等格式的文本
 * @returns 转换后的文本
 *
 * @example
 * 输入: "这是内容[[1]]，更多内容[[ID: 2]][[ID: 3]]，多引用[[4], [6], [12]]"
 * 输出: "这是内容[1](#ref-citation-1)，更多内容[2](#ref-citation-2)[3](#ref-citation-3)，多引用[4](#ref-citation-4)[6](#ref-citation-6)[12](#ref-citation-12)"
 */
export function convertBracketCitations(text: string): string {
  let result = text

  // 1. 处理 [[ID: x]] 格式
  result = result.replace(/\[\[ID:\s*(\d+)\]\]/g, '[$1](#ref-citation-$1)')

  // 2. 处理 [[x], [y], [z]] 多引用格式 (必须在单引用之前处理)
  // 匹配 [[数字], [数字], ...] 并转换为多个独立链接
  result = result.replace(/\[\[(\d+)(?:],\s*\[(\d+))+\]\]/g, (match) => {
    const numbers = match.match(/\d+/g) || []
    return numbers.map(n => `[${n}](#ref-citation-${n})`).join('')
  })

  // 3. 处理 [[x, y, z]] 逗号分隔多引用格式 (如 [[3, 11]])
  result = result.replace(/\[\[(\d+(?:\s*,\s*\d+)+)\]\]/g, (_, nums) => {
    return nums.split(',')
      .map((n: string) => n.trim())
      .map((n: string) => `[${n}](#ref-citation-${n})`)
      .join('')
  })

  // 4. 处理 [[x]] 单引用格式
  result = result.replace(/\[\[(\d+)\]\]/g, '[$1](#ref-citation-$1)')

  return result
}
