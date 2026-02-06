#!/usr/bin/env tsx
import './worker-env.ts'
import { ingestQueue } from '../lib/queue'

async function main() {
  const jobs = await ingestQueue.getRepeatableJobs()
  console.log('队列中的任务:', jobs.length)

  const waiting = await ingestQueue.getWaiting()
  console.log('等待中的任务:', waiting.length)

  const active = await ingestQueue.getActive()
  console.log('活跃的任务:', active.length)

  const failed = await ingestQueue.getFailed()
  console.log('失败的任务:', failed.length)

  if (failed.length > 0) {
    console.log('失败任务详情:')
    for (const job of failed) {
      console.log(`  - ID: ${job.id}, 原因: ${job.failedReason}`)
    }
  }

  const completed = await ingestQueue.getCompleted()
  console.log('完成的任务:', completed.length)

  await ingestQueue.close()
}

main().catch(console.error)
