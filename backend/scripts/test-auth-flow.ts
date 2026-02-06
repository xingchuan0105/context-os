/**
 * 用户认证流程分段测试
 *
 * 测试流程:
 * 1. 环境检查 (数据库、依赖)
 * 2. 注册功能测试
 * 3. 登录功能测试
 * 4. 会话验证测试
 * 5. 获取用户信息测试
 * 6. 清理测试数据
 *
 * 策略: 分段测试，遇到错误立即停止，不自动修复
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { signToken, verifyToken } from '../lib/auth/jwt'
import { hashPassword, verifyPassword } from '../lib/auth/password'
import { db, initializeDatabase } from '../lib/db/schema'

// 加载环境变量
const envPath = resolve(__dirname, '../.env')
const envTestPath = resolve(__dirname, '../.env.test')
config({ path: envPath }) // 先加载主 .env
config({ path: envTestPath }) // 再加载 .env.test 覆盖

// 测试配置
const TEST_USER = {
  email: `auth-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  fullName: 'Auth Test User'
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step: number, title: string) {
  console.log('\n' + '='.repeat(60))
  log(`步骤 ${step}: ${title}`, 'cyan')
  console.log('='.repeat(60))
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green')
}

function logError(message: string) {
  log(`❌ ${message}`, 'red')
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue')
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow')
}

// 测试结果记录
const testResults: {
  step: number
  name: string
  status: 'pass' | 'fail' | 'skip'
  error?: string
  duration: number
}[] = []

async function runTest(
  step: number,
  name: string,
  testFn: () => Promise<void>
) {
  const startTime = Date.now()
  try {
    logStep(step, name)
    await testFn()
    const duration = Date.now() - startTime
    testResults.push({ step, name, status: 'pass', duration })
    logSuccess(`${name} - 通过 (${duration}ms)`)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    testResults.push({ step, name, status: 'fail', error: errorMessage, duration })
    logError(`${name} - 失败`)
    logError(`错误: ${errorMessage}`)
    throw error // 立即停止测试
  }
}

// ==================== 测试步骤 ====================

async function step1_CheckEnvironment() {
  logInfo('检查环境配置...')

  // 检查数据库文件路径
  const dbPath = process.env.DATABASE_URL || resolve(process.cwd(), 'data', 'context-os.db')
  logInfo(`数据库路径: ${dbPath}`)

  // 检查 JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production') {
    logWarning('JWT_SECRET 使用默认值，生产环境应更改')
  } else {
    logInfo('JWT_SECRET 已配置')
  }

  // 初始化数据库
  logInfo('初始化数据库...')
  initializeDatabase()
  logSuccess('数据库初始化完成')

  // 检查 users 表
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  const hasUsersTable = tables.some(t => t.name === 'users')

  if (!hasUsersTable) {
    throw new Error('users 表不存在')
  }

  logSuccess('users 表存在')
}

async function step2_TestPasswordHashing() {
  logInfo('测试密码哈希功能...')

  const plainPassword = 'TestPassword123!'

  // 测试哈希
  const hashedPassword = await hashPassword(plainPassword)
  logInfo(`哈希后的密码长度: ${hashedPassword.length}`)

  if (!hashedPassword.includes(':')) {
    throw new Error('哈希格式错误，应该包含盐值和哈希值的分隔符')
  }

  const [salt, hash] = hashedPassword.split(':')
  if (!salt || !hash) {
    throw new Error('哈希格式错误，无法解析盐值和哈希值')
  }

  logInfo(`盐值长度: ${salt.length}`)
  logInfo(`哈希值长度: ${hash.length}`)

  // 测试验证
  const isValid = await verifyPassword(plainPassword, hashedPassword)
  if (!isValid) {
    throw new Error('密码验证失败')
  }

  logSuccess('密码哈希和验证功能正常')

  // 测试错误密码
  const isInvalid = await verifyPassword('WrongPassword', hashedPassword)
  if (isInvalid) {
    throw new Error('错误密码应该验证失败')
  }

  logSuccess('错误密码验证正确拒绝')
}

async function step3_TestJWTToken() {
  logInfo('测试 JWT Token 功能...')

  const payload = {
    userId: 'test-user-123',
    email: TEST_USER.email,
  }

  // 测试签发
  const token = await signToken(payload)
  logInfo(`Token 长度: ${token.length}`)
  logInfo(`Token 前50字符: ${token.substring(0, 50)}...`)

  if (token.split('.').length !== 3) {
    throw new Error('Token 格式错误，应该包含 header.payload.signature 三部分')
  }

  logSuccess('Token 签发成功')

  // 测试验证
  const decodedPayload = await verifyToken(token)
  if (!decodedPayload) {
    throw new Error('Token 验证失败')
  }

  if (decodedPayload.userId !== payload.userId || decodedPayload.email !== payload.email) {
    throw new Error('Token 解码后的 payload 与原始数据不匹配')
  }

  logSuccess('Token 验证成功')
  logInfo(`解码后的 userId: ${decodedPayload.userId}`)
  logInfo(`解码后的 email: ${decodedPayload.email}`)

  // 测试错误 token
  const invalidToken = 'invalid.token.here'
  const invalidPayload = await verifyToken(invalidToken)
  if (invalidPayload !== null) {
    throw new Error('错误 Token 应该返回 null')
  }

  logSuccess('错误 Token 正确拒绝')
}

async function step4_CreateTestUser() {
  logInfo('创建测试用户...')

  // 检查用户是否已存在
  const existingUser = db
    .prepare('SELECT id, email FROM users WHERE email = ?')
    .get(TEST_USER.email)

  if (existingUser) {
    logWarning(`测试用户已存在: ${TEST_USER.email}`)
    // 删除现有测试用户
    db.prepare('DELETE FROM users WHERE email = ?').run(TEST_USER.email)
    logInfo('已删除现有测试用户')
  }

  // 插入新用户
  const userId = `test-user-${Date.now()}`
  const passwordHash = await hashPassword(TEST_USER.password)

  const result = db
    .prepare(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
    )
    .run(userId, TEST_USER.email, passwordHash, TEST_USER.fullName)

  if (result.changes !== 1) {
    throw new Error('用户创建失败')
  }

  logSuccess(`用户创建成功: ${userId}`)

  // 验证用户已创建
  const user = db
    .prepare('SELECT id, email, full_name FROM users WHERE id = ?')
    .get(userId) as { id: string; email: string; full_name: string } | undefined

  if (!user) {
    throw new Error('无法查询到刚创建的用户')
  }

  logSuccess('用户查询验证成功')
  logInfo(`用户 ID: ${user.id}`)
  logInfo(`用户邮箱: ${user.email}`)
  logInfo(`用户姓名: ${user.full_name}`)

  return userId
}

async function step5_TestDirectLogin() {
  logInfo('测试直接数据库登录（绕过 API）...')

  // 查询用户
  const user = db
    .prepare(
      'SELECT id, email, password_hash, full_name FROM users WHERE email = ?'
    )
    .get(TEST_USER.email) as
    | { id: string; email: string; password_hash: string; full_name: string }
    | undefined

  if (!user) {
    throw new Error('用户不存在，请先运行步骤 4')
  }

  logInfo(`找到用户: ${user.id}`)

  // 验证密码
  const isValid = await verifyPassword(TEST_USER.password, user.password_hash)
  if (!isValid) {
    throw new Error('密码验证失败')
  }

  logSuccess('密码验证成功')

  // 验证错误密码
  const isInvalid = await verifyPassword('WrongPassword', user.password_hash)
  if (isInvalid) {
    throw new Error('错误密码不应该验证成功')
  }

  logSuccess('错误密码正确拒绝')
}

async function step6_TestSessionCreation() {
  logInfo('测试会话创建（Cookie 模拟）...')

  // 查询用户
  const user = db
    .prepare('SELECT id, email, full_name FROM users WHERE email = ?')
    .get(TEST_USER.email) as
    | { id: string; email: string; full_name: string }
    | undefined

  if (!user) {
    throw new Error('用户不存在')
  }

  // 模拟创建 token
  const token = await signToken({
    userId: user.id,
    email: user.email,
  })

  logInfo(`Token 已生成: ${token.substring(0, 50)}...`)

  // 验证 token
  const payload = await verifyToken(token)
  if (!payload) {
    throw new Error('Token 验证失败')
  }

  if (payload.userId !== user.id || payload.email !== user.email) {
    throw new Error('Token payload 不匹配')
  }

  logSuccess('会话创建和验证成功')
  logInfo(`会话用户 ID: ${payload.userId}`)
  logInfo(`会话用户邮箱: ${payload.email}`)
}

async function step7_TestGetCurrentUser() {
  logInfo('测试 getCurrentUser 功能（模拟）...')

  // 注意: 在测试环境中无法直接测试 Next.js cookies()
  // 这里我们模拟验证逻辑

  // 1. 创建 token
  const user = db
    .prepare('SELECT id, email, full_name, avatar_url FROM users WHERE email = ?')
    .get(TEST_USER.email) as
    | { id: string; email: string; full_name: string; avatar_url: string }
    | undefined

  if (!user) {
    throw new Error('用户不存在')
  }

  const token = await signToken({
    userId: user.id,
    email: user.email,
  })

  // 2. 验证 token
  const payload = await verifyToken(token)
  if (!payload) {
    throw new Error('Token 验证失败')
  }

  // 3. 从数据库获取用户（模拟 getCurrentUser 的逻辑）
  const dbUser = db
    .prepare('SELECT id, email, full_name, avatar_url FROM users WHERE id = ?')
    .get(payload.userId) as
    | { id: string; email: string; full_name: string; avatar_url: string }
    | undefined

  if (!dbUser) {
    throw new Error('无法从数据库获取用户')
  }

  if (dbUser.id !== user.id || dbUser.email !== user.email) {
    throw new Error('数据库用户信息与 token 不匹配')
  }

  logSuccess('getCurrentUser 逻辑验证成功')
  logInfo(`用户 ID: ${dbUser.id}`)
  logInfo(`用户邮箱: ${dbUser.email}`)
  logInfo(`用户姓名: ${dbUser.full_name}`)
}

async function step8_TestAPIEndpoints() {
  logInfo('测试 API 端点（需要服务器运行）...')

  const API_BASE = process.env.API_BASE || 'http://localhost:3000'

  logInfo(`API Base URL: ${API_BASE}`)

  // 测试健康检查
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
    }).catch(() => null)

    if (!response) {
      throw new Error('无法连接到服务器')
    }

    if (response.ok) {
      logSuccess('服务器健康检查通过')
    } else {
      logWarning('服务器响应不正常，但继续测试')
    }
  } catch (error) {
    throw new Error('服务器未运行，请先启动 `npm run dev`')
  }

  // 测试登录 API
  logInfo('测试登录 API: POST /api/auth/login')

  const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
  })

  const loginData = await loginResponse.json()

  logInfo(`登录响应状态: ${loginResponse.status}`)
  logInfo(`登录响应体: ${JSON.stringify(loginData, null, 2)}`)

  if (loginResponse.status !== 200) {
    throw new Error(`登录失败: ${JSON.stringify(loginData)}`)
  }

  if (!loginData.user || !loginData.user.id) {
    throw new Error('登录响应缺少用户信息')
  }

  logSuccess('登录 API 测试成功')
  logInfo(`登录用户 ID: ${loginData.user.id}`)
  logInfo(`登录用户邮箱: ${loginData.user.email}`)

  // 测试获取当前用户 API (需要 Cookie)
  logInfo('测试获取用户 API: GET /api/auth/me')

  // 从登录响应中获取 cookies
  const setCookieHeader = loginResponse.headers.get('set-cookie')
  if (!setCookieHeader) {
    throw new Error('登录响应未设置 Cookie')
  }

  logInfo(`Set-Cookie: ${setCookieHeader}`)

  const meResponse = await fetch(`${API_BASE}/api/auth/me`, {
    method: 'GET',
    headers: {
      'Cookie': setCookieHeader,
    },
  })

  const meData = await meResponse.json()

  logInfo(`获取用户响应状态: ${meResponse.status}`)
  logInfo(`获取用户响应体: ${JSON.stringify(meData, null, 2)}`)

  if (meResponse.status !== 200) {
    throw new Error(`获取用户失败: ${JSON.stringify(meData)}`)
  }

  if (!meData.user || meData.user.email !== TEST_USER.email) {
    throw new Error('获取的用户信息不匹配')
  }

  logSuccess('获取用户 API 测试成功')
}

async function step9_CleanupTestData() {
  logInfo('清理测试数据...')

  const result = db
    .prepare('DELETE FROM users WHERE email = ?')
    .run(TEST_USER.email)

  if (result.changes > 0) {
    logSuccess(`已删除 ${result.changes} 个测试用户`)
  } else {
    logWarning('未找到需要清理的测试用户')
  }
}

// ==================== 主测试流程 ====================

async function main() {
  console.log('\n' + '🔐'.repeat(30))
  log('用户认证流程分段测试', 'cyan')
  log('测试策略: 遇到错误立即停止，不自动修复', 'yellow')
  console.log('🔐'.repeat(30) + '\n')

  const startTime = Date.now()

  try {
    // 逐步执行测试
    await runTest(1, '环境检查', step1_CheckEnvironment)

    await runTest(2, '密码哈希功能', step2_TestPasswordHashing)

    await runTest(3, 'JWT Token 功能', step3_TestJWTToken)

    await runTest(4, '创建测试用户', step4_CreateTestUser)

    await runTest(5, '直接登录测试', step5_TestDirectLogin)

    await runTest(6, '会话创建测试', step6_TestSessionCreation)

    await runTest(7, 'getCurrentUser 逻辑测试', step7_TestGetCurrentUser)

    try {
      await runTest(8, 'API 端点测试', step8_TestAPIEndpoints)
    } catch (error) {
      logWarning('API 端点测试失败（可能是因为服务器未运行）')
      logInfo('如果服务器未运行，请先执行 `npm run dev`')
      logInfo('数据库功能测试已完成，可以继续下一步测试')
    }

    await runTest(9, '清理测试数据', step9_CleanupTestData)

    // 测试总结
    const duration = Date.now() - startTime
    console.log('\n' + '='.repeat(60))
    log('📊 测试总结', 'cyan')
    console.log('='.repeat(60))

    const passed = testResults.filter(r => r.status === 'pass').length
    const failed = testResults.filter(r => r.status === 'fail').length
    const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0)

    log(`总测试数: ${testResults.length}`, 'blue')
    log(`通过: ${passed}`, 'green')
    log(`失败: ${failed}`, failed > 0 ? 'red' : 'green')
    log(`总耗时: ${duration}ms`, 'blue')

    console.log('\n测试结果详情:')
    testResults.forEach(result => {
      const status = result.status === 'pass' ? '✅' : '❌'
      const color = result.status === 'pass' ? 'green' : 'red'
      log(`  ${status} 步骤 ${result.step}: ${result.name} (${result.duration}ms)`, color)
      if (result.error) {
        log(`      错误: ${result.error}`, 'red')
      }
    })

    if (failed === 0) {
      console.log('\n' + '🎉'.repeat(30))
      log('所有测试通过！用户认证流程正常', 'green')
      console.log('🎉'.repeat(30) + '\n')
    } else {
      console.log('\n' + '⚠️ '.repeat(30))
      log(`有 ${failed} 个测试失败，请检查上述错误信息`, 'yellow')
      console.log('⚠️ '.repeat(30) + '\n')
      process.exit(1)
    }

  } catch (error) {
    // 测试中断
    const duration = Date.now() - startTime

    console.log('\n' + '='.repeat(60))
    log('🛑 测试中断', 'red')
    console.log('='.repeat(60))

    const passed = testResults.filter(r => r.status === 'pass').length
    const failed = testResults.filter(r => r.status === 'fail').length

    log(`已完成: ${testResults.length} 个测试`, 'blue')
    log(`通过: ${passed}`, 'green')
    log(`失败: ${failed}`, 'red')
    log(`耗时: ${duration}ms`, 'blue')

    console.log('\n失败的测试:')
    testResults
      .filter(r => r.status === 'fail')
      .forEach(result => {
        log(`  ❌ 步骤 ${result.step}: ${result.name}`, 'red')
        log(`      错误: ${result.error}`, 'red')
      })

    console.log('\n' + '💡'.repeat(30))
    log('测试中断，请根据错误信息进行分段调试', 'yellow')
    log('建议:', 'yellow')
    log('  1. 查看上方错误堆栈信息', 'yellow')
    log('  2. 定位问题根本原因', 'yellow')
    log('   3. 修复后再重新运行测试', 'yellow')
    console.log('💡'.repeat(30) + '\n')

    process.exit(1)
  }
}

// 运行测试
main().catch((error) => {
  console.error('未捕获的错误:', error)
  process.exit(1)
})
