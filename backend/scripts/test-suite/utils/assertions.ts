/**
 * 断言工具 - 用于测试验证
 */

export interface AssertionResult {
  passed: boolean
  expected: any
  actual: any
  message: string
}

export class AssertionError extends Error {
  public readonly result: AssertionResult

  constructor(result: AssertionResult) {
    super(result.message)
    this.name = 'AssertionError'
    this.result = result
  }
}

/**
 * 断言工具类
 */
export class Assert {
  /**
   * 断言值为真
   */
  static isTrue(value: boolean, message = `Expected true, got ${value}`): AssertionResult {
    const result: AssertionResult = {
      passed: value === true,
      expected: true,
      actual: value,
      message,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言值为假
   */
  static isFalse(value: boolean, message = `Expected false, got ${value}`): AssertionResult {
    const result: AssertionResult = {
      passed: value === false,
      expected: false,
      actual: value,
      message,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言相等
   */
  static equal<T>(actual: T, expected: T, message?: string): AssertionResult {
    const result: AssertionResult = {
      passed: actual === expected,
      expected,
      actual,
      message: message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言深度相等
   */
  static deepEqual(actual: any, expected: any, message?: string): AssertionResult {
    const actualStr = JSON.stringify(actual)
    const expectedStr = JSON.stringify(expected)
    const result: AssertionResult = {
      passed: actualStr === expectedStr,
      expected,
      actual,
      message: message || `Objects are not deeply equal`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言不相等
   */
  static notEqual<T>(actual: T, expected: T, message?: string): AssertionResult {
    const result: AssertionResult = {
      passed: actual !== expected,
      expected: `not ${JSON.stringify(expected)}`,
      actual,
      message: message || `Expected ${actual} to not equal ${expected}`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言大于
   */
  static greaterThan(actual: number, expected: number, message?: string): AssertionResult {
    const result: AssertionResult = {
      passed: actual > expected,
      expected: `> ${expected}`,
      actual,
      message: message || `Expected ${actual} > ${expected}`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言小于
   */
  static lessThan(actual: number, expected: number, message?: string): AssertionResult {
    const result: AssertionResult = {
      passed: actual < expected,
      expected: `< ${expected}`,
      actual,
      message: message || `Expected ${actual} < ${expected}`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言包含
   */
  static contains(haystack: string | unknown[], needle: string, message?: string): AssertionResult {
    const result: AssertionResult = {
      passed: haystack.includes(needle),
      expected: `contains "${needle}"`,
      actual: haystack,
      message: message || `Expected "${haystack}" to contain "${needle}"`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言数组长度
   */
  static arrayLength(arr: unknown[], expected: number, message?: string): AssertionResult {
    const result: AssertionResult = {
      passed: arr.length === expected,
      expected: `length ${expected}`,
      actual: `length ${arr.length}`,
      message: message || `Expected array length ${expected}, got ${arr.length}`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言不为空
   */
  static notEmpty(value: string | unknown[], message?: string): AssertionResult {
    const isEmpty = typeof value === 'string' ? value.trim() === '' : value.length === 0
    const result: AssertionResult = {
      passed: !isEmpty,
      expected: 'not empty',
      actual: value,
      message: message || `Expected value to not be empty`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言为定义
   */
  static isDefined(value: unknown, message?: string): AssertionResult {
    const result: AssertionResult = {
      passed: value !== undefined && value !== null,
      expected: 'defined',
      actual: value === undefined ? 'undefined' : value === null ? 'null' : value,
      message: message || `Expected value to be defined`,
    }
    if (!result.passed) throw new AssertionError(result)
    return result
  }

  /**
   * 断言抛出异常
   */
  static async throws(fn: () => Promise<any> | any, message?: string): AssertionResult {
    try {
      await fn()
      const result: AssertionResult = {
        passed: false,
        expected: 'throw error',
        actual: 'no error',
        message: message || `Expected function to throw an error`,
      }
      throw new AssertionError(result)
    } catch (error) {
      if (error instanceof AssertionError) throw error
      return {
        passed: true,
        expected: 'throw error',
        actual: error instanceof Error ? error.message : String(error),
        message: 'Function threw as expected',
      }
    }
  }

  /**
   * 软断言 - 不抛出异常，只返回结果
   */
  static soft(fn: () => void): AssertionResult | null {
    try {
      fn()
      return null
    } catch (error) {
      if (error instanceof AssertionError) return error.result
      return {
        passed: false,
        expected: 'no error',
        actual: error instanceof Error ? error.message : String(error),
        message: 'Unexpected error',
      }
    }
  }
}

/**
 * 测试结果收集器
 */
export class TestResults {
  private assertions: AssertionResult[] = []
  private passed = 0
  private failed = 0

  add(result: AssertionResult): void {
    this.assertions.push(result)
    if (result.passed) {
      this.passed++
    } else {
      this.failed++
    }
  }

  getAssertions(): AssertionResult[] {
    return [...this.assertions]
  }

  getPassed(): number {
    return this.passed
  }

  getFailed(): number {
    return this.failed
  }

  getTotal(): number {
    return this.passed + this.failed
  }

  hasFailures(): boolean {
    return this.failed > 0
  }

  summary(): string {
    const total = this.getTotal()
    const passRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : '0'

    return `
断言统计:
  总计: ${total}
  通过: ${this.passed} ✅
  失败: ${this.failed} ❌
  通过率: ${passRate}%
`
  }
}
