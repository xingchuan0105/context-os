#!/usr/bin/env tsx
/**
 * 阿里云函数计算部署包构建脚本
 *
 * 用途:
 * 1. 复制必要的 lib 文件到函数目录
 * 2. 编译 TypeScript 代码
 * 3. 打包为 function.zip
 */

import { copyFile, mkdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const functionDir = resolve(rootDir, 'functions', 'document-processor')
const distDir = resolve(functionDir, 'dist')

// 需要复制的 lib 文件
const libFiles = [
  'lib/embedding.ts',
  'lib/parsers/index.ts',
  'lib/parsers/pdf.ts',
  'lib/parsers/docx.ts',
  'lib/parsers/web.ts',
  'lib/chunkers/index.ts',
  'lib/chunkers/parent-child.ts',
  'lib/processors/k-type.ts',
  'lib/processors/k-type-fast.ts',
  'lib/processors/k-type-summary.ts',
  'lib/processors/prompts.ts',
  'lib/oneapi.ts',
  'lib/qdrant.ts',
]

console.log('╔═══════════════════════════════════════════════════════════════╗')
console.log('║           阿里云函数计算部署包构建工具                          ║')
console.log('╚═══════════════════════════════════════════════════════════════╝')

/**
 * 确保目录存在
 */
async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

/**
 * 复制文件
 */
async function copyFileSafe(src: string, dest: string) {
  const srcPath = resolve(rootDir, src)
  const destPath = resolve(functionDir, dest)

  // 确保目标目录存在
  await ensureDir(dirname(destPath))

  try {
    await copyFile(srcPath, destPath)
    console.log(`✅ 复制: ${src} -> ${dest}`)
  } catch (error) {
    console.error(`❌ 复制失败: ${src}`, error)
    throw error
  }
}

/**
 * 执行命令
 */
function execCommand(command: string, cwd: string) {
  console.log(`🔄 执行: ${command}`)
  try {
    execSync(command, { cwd, stdio: 'inherit', shell: true })
  } catch (error) {
    console.error(`❌ 命令失败: ${command}`)
    throw error
  }
}

async function main() {
  // 1. 复制 lib 文件
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('1. 复制 lib 文件')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  for (const file of libFiles) {
    const destPath = file.replace('lib/', 'lib/')
    await copyFileSafe(file, destPath)
  }

  // 2. 安装函数依赖
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('2. 安装函数依赖')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  execCommand('npm install --production', functionDir)

  // 3. 编译 TypeScript
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('3. 编译 TypeScript')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  execCommand('npx tsc', functionDir)

  // 4. 检查编译输出
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('4. 检查编译输出')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const distFiles = await readdir(distDir)
  console.log(`✅ 编译完成，生成 ${distFiles.length} 个文件`)

  // 5. 打包
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('5. 打包 function.zip')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Windows 使用 PowerShell
  try {
    execCommand(
      'powershell -Command "Compress-Archive -Path dist\\*,node_modules\\* -DestinationPath function.zip -Force"',
      functionDir
    )
  } catch {
    // Unix 使用 zip
    try {
      execCommand('cd dist && zip -r ../function.zip * && cd .. && zip -ur function.zip node_modules/*', functionDir)
    } catch {
      console.warn('⚠️  打包失败，请手动打包 dist 目录和 node_modules 目录')
    }
  }

  // 6. 显示包信息
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('6. 部署包信息')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const { statSize } = await import('fs')
  try {
    const zipPath = resolve(functionDir, 'function.zip')
    const stats = await statSize(zipPath)
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
    console.log(`✅ function.zip 大小: ${sizeMB} MB`)
    console.log(`📍 位置: ${zipPath}`)
  } catch {
    console.log('⚠️  无法获取文件大小')
  }

  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                    ✅ 构建完成!                                  ║')
  console.log('╚════════════════════════════════━━━━━━━━━━━━━━━━━━━━━━━━━━━━═╝')
  console.log('\n下一步:')
  console.log('1. 登录阿里云函数计算控制台')
  console.log('2. 进入函数 document-processor')
  console.log('3. 上传 function.zip')
  console.log('4. 配置环境变量 (见 docs/fc-config-guide.md)')
}

main().catch((error) => {
  console.error('\n❌ 构建失败:', error.message)
  process.exit(1)
})
