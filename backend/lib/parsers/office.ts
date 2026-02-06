import { spawnSync } from 'child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

/**
 * Convert Office (PPT/PPTX/DOC/DOCX/XLS/XLSX) to PDF using LibreOffice/soffice.
 * Returns PDF buffer.
 */
export function convertOfficeToPdf(buffer: Buffer, fileName: string): Buffer {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'office-pdf-'))
  const inputPath = path.join(tmpDir, fileName)
  writeFileSync(inputPath, buffer)

  const outDir = tmpDir
  const officeBin = process.env.LIBREOFFICE_BIN || 'soffice'
  const timeout = parseInt(process.env.OFFICE_CONVERT_TIMEOUT_MS || '120000', 10)

  const run = spawnSync(
    officeBin,
    ['--headless', '--convert-to', 'pdf', '--outdir', outDir, inputPath],
    {
      timeout,
      encoding: 'utf-8',
    }
  )

  const outputPdf = path.join(outDir, fileName.replace(/\.[^.]+$/, '') + '.pdf')
  let pdfBuffer: Buffer
  try {
    pdfBuffer = readFileSync(outputPdf)
  } catch (err) {
    cleanup(tmpDir)
    throw new Error(`Office 转 PDF 失败: ${run.stderr || run.stdout || err}`)
  }

  cleanup(tmpDir)
  return pdfBuffer
}

function cleanup(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}
