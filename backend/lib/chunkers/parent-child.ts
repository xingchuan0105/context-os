// 父子���块处理器 - 原生实现
// 不依赖 LangChain，使用原生 TypeScript 实现
//
// 实现原理：
// - RecursiveCharacterTextSplitter: 递归地按分隔符切分文本，优先使用高优先级分隔符
// - 先生成大块（父块），再为每个父块生成小块（子块）
// - 支持重叠切分以保留上下文
//

export interface ParentChildSplitOptions {
  // 父块配置
  parentChunkSize?: number
  parentChunkOverlap?: number
  parentSeparators?: string[]

  // 子块配置
  childChunkSize?: number
  childChunkOverlap?: number
  childSeparators?: string[]

  // 清理选项
  removeExtraSpaces?: boolean
  removeUrlsEmails?: boolean
}

export interface ChunkResult {
  parentChunks: Array<{
    index: number
    content: string
  }>
  childChunks: Array<{
    index: number
    parentIndex: number
    content: string
  }>
}

/**
 * 原生递归文本分割器
 *
 * 实现逻辑：
 * 1. 按分隔符优先级尝试分割
 * 2. 如果分割后的块太大，继续用低优先级分隔符分割
 * 3. 如果单个块超过 chunkSize，强制按字符切分
 */
class RecursiveCharacterTextSplitter {
  private chunkSize: number
  private chunkOverlap: number
  private separators: string[]
  private lengthFunction: (text: string) => number

  constructor(options: {
    chunkSize: number
    chunkOverlap: number
    separators: string[]
    lengthFunction?: (text: string) => number
  }) {
    this.chunkSize = options.chunkSize
    this.chunkOverlap = options.chunkOverlap
    this.separators = options.separators
    this.lengthFunction = options.lengthFunction || ((text: string) => text.length)
  }

  /**
   * 分割文本
   */
  splitText(text: string): string[] {
    // 如果文本本身不超过 chunkSize，直接返回
    if (this.lengthFunction(text) <= this.chunkSize) {
      return [text]
    }

    // 按分隔符优先级递归分割
    return this.splitBySeparators(text, this.separators)
  }

  /**
   * 按分隔符递归分割
   */
  private splitBySeparators(text: string, separators: string[]): string[] {
    // 如果没有更多分隔符，强制按字符切分
    if (separators.length === 0) {
      return this.splitByCharacter(text)
    }

    const separator = separators[0]
    const remainingSeparators = separators.slice(1)

    // 按当前分隔符分割
    const splits = text.split(separator)

    const chunks: string[] = []
    let currentChunk = ''

    for (const split of splits) {
      const splitWithSeparator = split + separator
      const testChunk = currentChunk + splitWithSeparator

      // 如果当前块加上新分割部分不超过限制，继续累加
      if (this.lengthFunction(testChunk) <= this.chunkSize) {
        currentChunk = testChunk
      } else {
        // 当前块已满，保存并开始新块
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim())
        }

        // 如果单个分割部分超过 chunkSize，递归使用更低优先级的分隔符
        if (this.lengthFunction(splitWithSeparator) > this.chunkSize) {
          const subChunks = this.splitBySeparators(split.trim(), remainingSeparators)
          chunks.push(...subChunks)
          currentChunk = ''
        } else {
          currentChunk = splitWithSeparator
        }
      }
    }

    // 处理最后一块
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }

    // 应用重叠逻辑
    return this.applyOverlap(chunks)
  }

  /**
   * 强制按字符切分（当所有分隔符都无法满足大小时）
   */
  private splitByCharacter(text: string): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length)
      chunks.push(text.slice(start, end))

      // 移动到下一个块的起始位置（考虑重叠）
      start = end - this.chunkOverlap
    }

    return chunks
  }

  /**
   * 应用重叠逻辑
   */
  private applyOverlap(chunks: string[]): string[] {
    if (this.chunkOverlap <= 0 || chunks.length <= 1) {
      return chunks
    }

    const result: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      if (i === 0) {
        // 第一块不需要重叠
        result.push(chunk)
      } else {
        // 从上一块的末尾取重叠部分
        const prevChunk = result[i - 1]
        const overlapText = prevChunk.slice(-this.chunkOverlap)
        result.push(overlapText + chunk)
      }
    }

    return result
  }
}

/**
 * 创建父子分块器
 */
export function createParentChildSplitter(options: ParentChildSplitOptions = {}) {
  const {
    // 父块：加大尺寸并提高重叠，匹配更长上下文
    parentChunkSize = 1600,
    parentChunkOverlap = 240,
    parentSeparators = ['\n\n', '\n', '。', '，', ' ', ''],
    // 子块：放大并增加重叠，降低跨句信息丢失
    childChunkSize = 420,
    childChunkOverlap = 120,
    childSeparators = ['\n', '。', '，', ' ', ''],
  } = options

  return {
    parentSplitter: new RecursiveCharacterTextSplitter({
      chunkSize: parentChunkSize,
      chunkOverlap: parentChunkOverlap,
      separators: parentSeparators,
    }),
    childSplitter: new RecursiveCharacterTextSplitter({
      chunkSize: childChunkSize,
      chunkOverlap: childChunkOverlap,
      separators: childSeparators,
    }),
  }
}

/**
 * 清理文本
 */
function cleanText(
  text: string,
  options: Pick<ParentChildSplitOptions, 'removeExtraSpaces' | 'removeUrlsEmails'>
): string {
  let cleaned = text

  if (options.removeExtraSpaces) {
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
  }

  if (options.removeUrlsEmails) {
    cleaned = cleaned
      .replace(/https?:\/\/[^\s]+/gi, '')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
  }

  return cleaned
}

/**
 * 执行父子分块 - 原生实现
 */
export async function splitIntoParentChildChunks(
  text: string,
  options: ParentChildSplitOptions = {}
): Promise<ChunkResult> {
  const {
    removeExtraSpaces = false,
    removeUrlsEmails = false,
  } = options

  // 清理文本
  const cleanedText = cleanText(text, { removeExtraSpaces, removeUrlsEmails })

  // 创建分块器
  const { parentSplitter, childSplitter } = createParentChildSplitter(options)

  // 先生成父块
  const parentTexts = parentSplitter.splitText(cleanedText)

  // 对每个父块生成子块
  const parentChunks: Array<{ index: number; content: string }> = []
  const childChunks: Array<{ index: number; parentIndex: number; content: string }> = []

  let childIndex = 0

  for (let parentIndex = 0; parentIndex < parentTexts.length; parentIndex++) {
    const parentContent = parentTexts[parentIndex]

    // 添加父块
    parentChunks.push({
      index: parentIndex,
      content: parentContent,
    })

    // 为这个父块生成子块
    const childTexts = childSplitter.splitText(parentContent)

    // 添加子块
    for (const childText of childTexts) {
      childChunks.push({
        index: childIndex++,
        parentIndex,
        content: childText,
      })
    }
  }

  return {
    parentChunks,
    childChunks,
  }
}

/**
 * 批量分块（适用于大文档）
 * 使用串行处理以避免内存峰值
 */
export async function splitIntoParentChildChunksBatch(
  text: string,
  options: ParentChildSplitOptions = {}
): Promise<ChunkResult> {
  // 对于大文档，先进行预分块，然后串行处理以控制内存
  const MAX_SINGLE_SPLIT_LENGTH = 50000

  if (text.length <= MAX_SINGLE_SPLIT_LENGTH) {
    return splitIntoParentChildChunks(text, options)
  }

  // 合并结果
  const parentChunks: Array<{ index: number; content: string }> = []
  const childChunks: Array<{ index: number; parentIndex: number; content: string }> = []

  let parentOffset = 0
  let childOffset = 0

  // 分割成多个部分，但串行处理以避免内存峰值
  let remaining = text

  while (remaining.length > 0) {
    const splitPoint = Math.min(MAX_SINGLE_SPLIT_LENGTH, remaining.length)
    const chunk = remaining.slice(0, splitPoint)
    remaining = remaining.slice(splitPoint)

    // 串行处理每个部分，处理完立即释放
    const result = await splitIntoParentChildChunks(chunk, options)

    // 立即合并结果
    for (const parent of result.parentChunks) {
      parentChunks.push({
        index: parentOffset + parent.index,
        content: parent.content,
      })
    }

    for (const child of result.childChunks) {
      childChunks.push({
        index: childOffset + child.index,
        parentIndex: parentOffset + child.parentIndex,
        content: child.content,
      })
    }

    parentOffset += result.parentChunks.length
    childOffset += result.childChunks.length

    // 清除引用，帮助垃圾回收
    result.parentChunks.length = 0
    result.childChunks.length = 0
  }

  return {
    parentChunks,
    childChunks,
  }
}

/**
 * 流式父子分块（适用于大文档）
 * 按固定长度切片，逐段生成父块与子块
 */
export async function* splitIntoParentChildChunksStream(
  text: string,
  options: ParentChildSplitOptions = {}
): AsyncGenerator<ChunkResult> {
  const MAX_SINGLE_SPLIT_LENGTH = 50000

  if (text.length <= MAX_SINGLE_SPLIT_LENGTH) {
    yield await splitIntoParentChildChunks(text, options)
    return
  }

  let parentOffset = 0
  let childOffset = 0
  let remaining = text

  while (remaining.length > 0) {
    const splitPoint = Math.min(MAX_SINGLE_SPLIT_LENGTH, remaining.length)
    const chunk = remaining.slice(0, splitPoint)
    remaining = remaining.slice(splitPoint)

    const result = await splitIntoParentChildChunks(chunk, options)
    const parentChunks = result.parentChunks.map((parent) => ({
      index: parentOffset + parent.index,
      content: parent.content,
    }))
    const childChunks = result.childChunks.map((child) => ({
      index: childOffset + child.index,
      parentIndex: parentOffset + child.parentIndex,
      content: child.content,
    }))

    parentOffset += result.parentChunks.length
    childOffset += result.childChunks.length

    yield { parentChunks, childChunks }
  }
}
