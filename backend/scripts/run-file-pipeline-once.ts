#!/usr/bin/env tsx
/**
 * 针对单个文件跑一遍解析→K-Type→分块→Embedding→Qdrant 的完整流程，并输出各阶段耗时。
 * 使用 .env.local 的配置（LiteLLM、Qdrant、OCR、LibreOffice 等）。
 *
 * 用法：
 *   tsx scripts/run-file-pipeline-once.ts "<绝对或相对路径>"
 */

import { config } from 'dotenv'
import { resolve, extname, basename } from 'path'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

// 加载本地环境变量
config({ path: resolve(__dirname, '../.env.local') })

import { parseFile } from '../lib/parsers'
import { processKTypeWorkflowWithFallback } from '../lib/processors'
import { splitIntoParentChildChunksBatch } from '../lib/chunkers'
import embeddingClient from '../lib/embedding'
import {
  ensureUserCollection,
  batchUpsert,
  deleteDocumentChunks,
  type VectorPoint,
} from '../lib/qdrant'

const argPath = process.argv[2]
if (!argPath) {
  console.error('请提供文件路径。例如: tsx scripts/run-file-pipeline-once.ts "./test.pdf"')
  process.exit(1)
}

const filePath = resolve(argPath)
const ext = extname(filePath).toLowerCase()

// 简单 MIME 映射（够用即可）
const mimeMap: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
}
const mimeType = mimeMap[ext] || 'application/octet-stream'

// 基础标识
const userId = 'perf-user'
const kbId = 'perf-kb'
const docId = `perf-${basename(filePath)}-${Date.now()}`

async function main() {
  const fileBuffer = readFileSync(filePath)

  type StageStat = {
    durationMs: number
    rssMB: number
    heapUsedMB: number
    externalMB: number
    cpuUserMs: number
    cpuSystemMs: number
  }
  type MemPeak = {
    rssMB: number
    heapUsedMB: number
    externalMB: number
  }
  const stages: Record<string, StageStat> = {}
  let lastUsage = process.resourceUsage()
  const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100
  const initStage = (): StageStat => ({
    durationMs: 0,
    rssMB: 0,
    heapUsedMB: 0,
    externalMB: 0,
    cpuUserMs: 0,
    cpuSystemMs: 0,
  })
  const initPeak = (): MemPeak => ({
    rssMB: 0,
    heapUsedMB: 0,
    externalMB: 0,
  })
  const updateMax = (stage: MemPeak, mem: NodeJS.MemoryUsage) => {
    stage.rssMB = Math.max(stage.rssMB, toMB(mem.rss))
    stage.heapUsedMB = Math.max(stage.heapUsedMB, toMB(mem.heapUsed))
    stage.externalMB = Math.max(stage.externalMB, toMB(mem.external))
  }
  const addCpuUsage = (stage: StageStat, start: NodeJS.ResourceUsage, end: NodeJS.ResourceUsage) => {
    stage.cpuUserMs += (end.userCPUTime - start.userCPUTime) / 1000
    stage.cpuSystemMs += (end.systemCPUTime - start.systemCPUTime) / 1000
  }
  const mark = (label: string, start: number) => {
    const now = performance.now()
    const usage = process.resourceUsage()
    const mem = process.memoryUsage()
    stages[label] = {
      durationMs: now - start,
      rssMB: toMB(mem.rss),
      heapUsedMB: toMB(mem.heapUsed),
      externalMB: toMB(mem.external),
      cpuUserMs: (usage.userCPUTime - lastUsage.userCPUTime) / 1000,
      cpuSystemMs: (usage.systemCPUTime - lastUsage.systemCPUTime) / 1000,
    }
    lastUsage = usage
    return now
  }

  const stagePeaks: Record<string, MemPeak> = {
    parse: initPeak(),
    ktype: initPeak(),
    chunk: initPeak(),
    embedding: initPeak(),
    upsert: initPeak(),
    total: initPeak(),
  }
  let currentStage: keyof typeof stagePeaks = 'parse'
  const sampleIntervalMs = Math.max(0, parseInt(process.env.PERF_SAMPLE_INTERVAL_MS || '200', 10))
  const samplingEnabled = sampleIntervalMs > 0
  const sample = () => {
    const mem = process.memoryUsage()
    if (currentStage in stagePeaks) {
      updateMax(stagePeaks[currentStage], mem)
    }
    updateMax(stagePeaks.total, mem)
  }
  const sampler = samplingEnabled ? setInterval(sample, sampleIntervalMs) : null
  if (samplingEnabled) sample()

  console.log('🚀 开始处理文件:', filePath)
  console.log('MIME:', mimeType)

  let t = performance.now()

  // 1) 解析
  currentStage = 'parse'
  if (samplingEnabled) sample()
  const parseResult = await parseFile(fileBuffer, mimeType, basename(filePath))
  t = mark('parse', t)
  console.log(`解析完成，字符数=${parseResult.content.length}, 页面数=${parseResult.pages?.length ?? 0}`)
  const baseName = basename(filePath, ext)
  const ocrModel = process.env.VISION_OCR_MODEL || 'default'
  const safeModel = ocrModel.replace(/[^a-zA-Z0-9._-]+/g, '_')
  const ocrOutDir = resolve(__dirname, '../tmp/ocr')
  mkdirSync(ocrOutDir, { recursive: true })
  const ocrOutPath = resolve(ocrOutDir, `${baseName}.${safeModel}.md`)
  writeFileSync(ocrOutPath, parseResult.content, 'utf-8')
  console.log(`OCR/???????: ${ocrOutPath}`)

  // 2) K-Type
  currentStage = 'ktype'
  if (samplingEnabled) sample()
  const ktype = await processKTypeWorkflowWithFallback(parseResult.content)
  t = mark('ktype', t)
  const summaryText = ktype?.finalReport?.distilledContent || ktype?.finalReport?.executiveSummary || ''
  console.log('K-Type ???????=', summaryText.length)
  const ktypeOutDir = resolve(__dirname, '../tmp/ktype')
  mkdirSync(ktypeOutDir, { recursive: true })
  const ktypeOutPath = resolve(ktypeOutDir, `${baseName}.${safeModel}.md`)
  writeFileSync(ktypeOutPath, summaryText, 'utf-8')
  console.log(`K-Type ??: ${ktypeOutPath}`)

  // 3) 分块（父子）
  currentStage = 'chunk'
  if (samplingEnabled) sample()
  const { parentChunks, childChunks } = await splitIntoParentChildChunksBatch(parseResult.content, {
    parentChunkSize: 1200,
    parentChunkOverlap: 100,
    childChunkSize: 300,
    childChunkOverlap: 30,
  })
  t = mark('chunk', t)
  console.log(`分块完成：父块 ${parentChunks.length} 个，子块 ${childChunks.length} 个`)

  // 4) Embedding + Qdrant (streaming)
  currentStage = 'embedding'
  if (samplingEnabled) sample()
  const embeddingModel = process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b'
  const batchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '50', 10)
  await ensureUserCollection(userId)

  const embeddingStage = initStage()
  const upsertStage = initStage()
  let embeddingCount = 0
  let totalPoints = 0

  if (childChunks.length === 0 && parentChunks.length > 0) {
    for (let i = 0; i < parentChunks.length; i += batchSize) {
      const batchParents = parentChunks.slice(i, i + batchSize)
      currentStage = 'embedding'
      if (samplingEnabled) sample()
      const embedStart = performance.now()
      const embedUsageStart = process.resourceUsage()
      const embedRes = await embeddingClient.embeddings.create({
        model: embeddingModel,
        input: batchParents.map((p) => p.content),
      })
      const embedUsageEnd = process.resourceUsage()
      embeddingStage.durationMs += performance.now() - embedStart
      addCpuUsage(embeddingStage, embedUsageStart, embedUsageEnd)
      updateMax(embeddingStage, process.memoryUsage())
      embeddingCount += embedRes.data.length

      const batchPoints: VectorPoint[] = embedRes.data.map((item, idx) => ({
        id: randomUUID(),
        vector: item.embedding,
        payload: {
          doc_id: docId,
          kb_id: kbId,
          user_id: userId,
          type: 'parent',
          content: batchParents[idx].content,
          chunk_index: batchParents[idx].index,
        },
      }))

      currentStage = 'upsert'
      if (samplingEnabled) sample()
      const upsertStart = performance.now()
      const upsertUsageStart = process.resourceUsage()
      await batchUpsert(userId, batchPoints, 50)
      const upsertUsageEnd = process.resourceUsage()
      upsertStage.durationMs += performance.now() - upsertStart
      addCpuUsage(upsertStage, upsertUsageStart, upsertUsageEnd)
      updateMax(upsertStage, process.memoryUsage())
      totalPoints += batchPoints.length
    }
  } else {
    let nextParentIndex = 0
    let lastChildVector: number[] | null = null

    for (let i = 0; i < childChunks.length; i += batchSize) {
      const batchChildren = childChunks.slice(i, i + batchSize)
      currentStage = 'embedding'
      if (samplingEnabled) sample()
      const embedStart = performance.now()
      const embedUsageStart = process.resourceUsage()
      const embedRes = await embeddingClient.embeddings.create({
        model: embeddingModel,
        input: batchChildren.map((c) => c.content),
      })
      const embedUsageEnd = process.resourceUsage()
      embeddingStage.durationMs += performance.now() - embedStart
      addCpuUsage(embeddingStage, embedUsageStart, embedUsageEnd)
      updateMax(embeddingStage, process.memoryUsage())
      embeddingCount += embedRes.data.length

      if (embedRes.data.length > 0) {
        lastChildVector = embedRes.data[embedRes.data.length - 1].embedding
      }

      const batchPoints: VectorPoint[] = []
      for (let idx = 0; idx < batchChildren.length; idx++) {
        const child = batchChildren[idx]
        const vector = embedRes.data[idx].embedding
        batchPoints.push({
          id: randomUUID(),
          vector,
          payload: {
            doc_id: docId,
            kb_id: kbId,
            user_id: userId,
            type: 'child',
            content: child.content,
            chunk_index: child.index,
            parent_index: child.parentIndex,
            metadata: {
              file_name: basename(filePath),
            },
          },
        })
      }

      const maxVectorIndex = i + embedRes.data.length - 1
      while (nextParentIndex < parentChunks.length && nextParentIndex <= maxVectorIndex) {
        const parent = parentChunks[nextParentIndex]
        const vector = embedRes.data[nextParentIndex - i].embedding
        batchPoints.push({
          id: randomUUID(),
          vector,
          payload: {
            doc_id: docId,
            kb_id: kbId,
            user_id: userId,
            type: 'parent',
            content: parent.content,
            chunk_index: parent.index,
          },
        })
        nextParentIndex += 1
      }

      if (batchPoints.length > 0) {
        currentStage = 'upsert'
        if (samplingEnabled) sample()
        const upsertStart = performance.now()
        const upsertUsageStart = process.resourceUsage()
        await batchUpsert(userId, batchPoints, 50)
        const upsertUsageEnd = process.resourceUsage()
        upsertStage.durationMs += performance.now() - upsertStart
        addCpuUsage(upsertStage, upsertUsageStart, upsertUsageEnd)
        updateMax(upsertStage, process.memoryUsage())
        totalPoints += batchPoints.length
      }
    }

    if (nextParentIndex < parentChunks.length && lastChildVector) {
      const remainingParents: VectorPoint[] = []
      for (; nextParentIndex < parentChunks.length; nextParentIndex += 1) {
        const parent = parentChunks[nextParentIndex]
        remainingParents.push({
          id: randomUUID(),
          vector: lastChildVector,
          payload: {
            doc_id: docId,
            kb_id: kbId,
            user_id: userId,
            type: 'parent',
            content: parent.content,
            chunk_index: parent.index,
          },
        })
      }
      if (remainingParents.length > 0) {
        currentStage = 'upsert'
        if (samplingEnabled) sample()
        const upsertStart = performance.now()
        const upsertUsageStart = process.resourceUsage()
        await batchUpsert(userId, remainingParents, 50)
        const upsertUsageEnd = process.resourceUsage()
        upsertStage.durationMs += performance.now() - upsertStart
        addCpuUsage(upsertStage, upsertUsageStart, upsertUsageEnd)
        updateMax(upsertStage, process.memoryUsage())
        totalPoints += remainingParents.length
      }
    }
  }

  stages.embedding = embeddingStage
  stages.upsert = upsertStage
  console.log('Embedding 完成')
  console.log(`写入 Qdrant 完成，points=${totalPoints}`)

  currentStage = 'total'
  if (samplingEnabled) sample()
  if (sampler) {
    clearInterval(sampler)
  }

  const total = Object.values(stages).reduce((a, b) => a + b.durationMs, 0)
  console.log('⏱️  耗时(ms):', stages, 'total=', total.toFixed(0))
  console.log('📌 docId=', docId, 'kbId=', kbId)
  const perfSummary = {
    file: {
      path: filePath,
      name: basename(filePath),
      sizeBytes: fileBuffer.length,
      mimeType,
    },
    docId,
    kbId,
    pages: parseResult.pages?.length ?? 0,
    textLength: parseResult.content.length,
    chunks: { parent: parentChunks.length, child: childChunks.length },
    embeddingCount,
    stages,
    memPeaks: stagePeaks,
    totalMs: Number(total.toFixed(0)),
    timestamp: new Date().toISOString(),
  }

  const perfOutPath = process.env.PERF_OUT_PATH
  if (perfOutPath) {
    writeFileSync(perfOutPath, JSON.stringify(perfSummary, null, 2), 'utf-8')
    console.log(`? ???????: ${perfOutPath}`)
  } else {
    console.log('PERF_RESULT', JSON.stringify(perfSummary))
  }

  console.log('✅ 本轮完成。如需清理：node -e "require(\'./lib/qdrant\').deleteDocumentChunks(\'perf-user\', \'${docId}\').then(()=>console.log(\'deleted\'))"')
}

main().catch(err => {
  console.error('❌ 处理失败:', err)
  process.exit(1)
})
