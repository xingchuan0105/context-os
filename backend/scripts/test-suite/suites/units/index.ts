/**
 * 单元测试套件入口
 */

export { runParserUnitTests } from './parse.test'
export { runChunkUnitTests } from './chunk.test'
export { runKTypeUnitTests } from './ktype.test'
export { runEmbeddingUnitTests } from './embed.test'

import { runParserUnitTests } from './parse.test'
import { runChunkUnitTests } from './chunk.test'
import { runKTypeUnitTests } from './ktype.test'
import { runEmbeddingUnitTests } from './embed.test'
import { reporter } from '../../reporters/console'

/**
 * 运行所有单元测试
 */
export async function runAllUnitTests(options?: {
  skipKType?: boolean
  mockKType?: boolean
}): Promise<boolean> {
  reporter.title('单元测试套件 (L2)')

  const results: boolean[] = []

  // 解析器测试
  results.push(await runParserUnitTests())

  // 分块器测试
  results.push(await runChunkUnitTests())

  // K-Type 测试（默认使用 Mock）
  if (!options?.skipKType) {
    results.push(await runKTypeUnitTests(options?.mockKType !== false))
  }

  // Embedding 测试
  results.push(await runEmbeddingUnitTests())

  const allPassed = results.every(r => r)

  reporter.summary([
    {
      name: '单元测试套件',
      status: allPassed ? 'pass' : 'fail',
      duration: 0,
    },
  ])

  return allPassed
}
