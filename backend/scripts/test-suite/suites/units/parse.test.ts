/**
 * L2: 单元测试 - 解析器
 *
 * 目标: 每个解析器测试 < 10 秒
 */

import { timer } from '../../utils/timer'
import { checkMetric } from '../../utils/metrics'
import { reporter } from '../../reporters/console'
import { parseFile, isSupportedFormat } from '../../../../lib/parsers'
import { Assert } from '../../utils/assertions'

// 测试数据
const TEST_PDF_BUFFER = Buffer.from('%PDF-1.4\n%fake pdf content for testing')
const TEST_TXT_CONTENT = 'This is a test text file.\nIt has multiple lines.\nAnd some content.'
const TEST_TXT_BUFFER = Buffer.from(TEST_TXT_CONTENT)
const TEST_MD_CONTENT = '# Test Markdown\n\nThis is a **test** markdown file.'
const TEST_MD_BUFFER = Buffer.from(TEST_MD_CONTENT)

export class ParserUnitTests {
  /**
   * 运行所有解析器单元测试
   */
  async runAll(): Promise<boolean> {
    reporter.title('解析器单元测试 (L2)')

    const results: boolean[] = []

    results.push(await this.testTxtParser())
    results.push(await this.testMdParser())
    results.push(await this.testFormatDetection())
    results.push(await this.testEdgeCases())

    const allPassed = results.every(r => r)

    reporter.summary([
      {
        name: '解析器单元测试',
        status: allPassed ? 'pass' : 'fail',
        duration: 0,
      },
    ])

    return allPassed
  }

  /**
   * 测试 TXT 解析器
   */
  private async testTxtParser(): Promise<boolean> {
    reporter.subsection('TXT 解析器测试')
    reporter.indentIn()

    try {
      const duration = await timer.measure('parse.txt', async () => {
        const result = await parseFile(TEST_TXT_BUFFER, 'text/plain', 'test.txt')

        Assert.equal(result.content, TEST_TXT_CONTENT, 'TXT content mismatch')
        Assert.notEmpty(result.content, 'TXT content should not be empty')
      })

      const metric = checkMetric('parse.txt', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`TXT 解析器测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试 Markdown 解析器
   */
  private async testMdParser(): Promise<boolean> {
    reporter.subsection('Markdown 解析器测试')
    reporter.indentIn()

    try {
      const duration = await timer.measure('parse.md', async () => {
        const result = await parseFile(TEST_MD_BUFFER, 'text/markdown', 'test.md')

        Assert.equal(result.content, TEST_MD_CONTENT, 'MD content mismatch')
        Assert.notEmpty(result.content, 'MD content should not be empty')
      })

      // Markdown 解析复用 TXT 逻辑，使用 TXT 阈值
      const metric = checkMetric('parse.txt', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`Markdown 解析器测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试格式检测
   */
  private async testFormatDetection(): Promise<boolean> {
    reporter.subsection('格式检测测试')
    reporter.indentIn()

    try {
      // 测试支持的格式
      Assert.isTrue(isSupportedFormat('text/plain', 'test.txt'), 'text/plain should be supported')
      Assert.isTrue(isSupportedFormat('text/markdown', 'test.md'), 'text/markdown should be supported')
      Assert.isTrue(isSupportedFormat('', 'test.txt'), 'txt extension should be supported')
      Assert.isTrue(isSupportedFormat('', 'test.md'), 'md extension should be supported')

      // 测试不支持的格式
      Assert.isFalse(isSupportedFormat('application/octet-stream', 'test.bin'), 'bin should not be supported')

      reporter.success('格式检测测试通过')
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`格式检测测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试边界情况
   */
  private async testEdgeCases(): Promise<boolean> {
    reporter.subsection('边界情况测试')
    reporter.indentIn()

    try {
      // 空文件
      const emptyBuffer = Buffer.from('')
      const emptyResult = await parseFile(emptyBuffer, 'text/plain', 'empty.txt')
      Assert.equal(emptyResult.content, '', 'Empty file should return empty content')

      // 只有空格
      const whitespaceBuffer = Buffer.from('   \n\n   \n')
      const whitespaceResult = await parseFile(whitespaceBuffer, 'text/plain', 'whitespace.txt')
      Assert.equal(whitespaceResult.content.trim(), '', 'Whitespace content should be empty after trim')

      reporter.success('边界情况测试通过')
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`边界情况测试失败: ${error.message}`)
      return false
    }
  }
}

/**
 * 导出测试运行函数
 */
export async function runParserUnitTests(): Promise<boolean> {
  const tests = new ParserUnitTests()
  return tests.runAll()
}
