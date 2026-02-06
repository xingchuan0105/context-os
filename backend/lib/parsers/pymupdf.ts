import { spawnSync } from 'child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { parseJSON } from '../utils/json'

type PyMuPDFResult = { content: string; mimeType: string }
export type PdfInspection = { total_pages: number; text_pages: number }
export type PageImage = {
  page: number
  dataUrl?: string
  filePath?: string
  mimeType?: string
}

type ImageFormatConfig = {
  format: 'png' | 'jpeg'
  mimeType: string
  extension: string
  jpegQuality: number
}

function resolveImageFormat(): ImageFormatConfig {
  const rawFormat = (process.env.PYMUPDF_IMAGE_FORMAT || 'png').toLowerCase()
  const useJpeg = rawFormat === 'jpg' || rawFormat === 'jpeg'
  const qualityRaw = parseInt(process.env.PYMUPDF_IMAGE_JPEG_QUALITY || '82', 10)
  const jpegQuality = Number.isFinite(qualityRaw)
    ? Math.min(100, Math.max(1, qualityRaw))
    : 82

  return {
    format: useJpeg ? 'jpeg' : 'png',
    mimeType: useJpeg ? 'image/jpeg' : 'image/png',
    extension: useJpeg ? 'jpg' : 'png',
    jpegQuality,
  }
}

/**
 * Use PyMuPDF (fitz) via Python to extract text from PDFs.
 * Env vars:
 * - PYMUPDF_PYTHON: python executable (default "py")
 * - PYMUPDF_PYTHON_ARGS: args passed before -c (default "-3.11")
 * - PYMUPDF_TIMEOUT_MS: timeout in ms (default 180000)
 */
export function parseWithPyMuPDF(buffer: Buffer, fileName: string): PyMuPDFResult {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'pymupdf-'))
  const inputPath = path.join(tmpDir, fileName || 'input.pdf')
  writeFileSync(inputPath, buffer)

  const pyBin = process.env.PYMUPDF_PYTHON || 'py'
  const pyArgs = (process.env.PYMUPDF_PYTHON_ARGS || '-3.11').split(/\s+/).filter(Boolean)
  const timeout = parseInt(process.env.PYMUPDF_TIMEOUT_MS || '180000', 10)

  const pythonCode = `
import sys
import fitz  # PyMuPDF

doc = fitz.open(sys.argv[1])
out = []
for page in doc:
    text = page.get_text(\"text\") or \"\"
    out.append(f\"\\n\\n## Page {page.number + 1}\\n\\n{text.strip()}\".strip())

print(\"\\n\".join(out))
`

  const run = spawnSync(pyBin, [...pyArgs, '-c', pythonCode, inputPath], {
    timeout,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 64 * 1024 * 1024, // allow large docs
  })

  cleanup(tmpDir)

  if (run.error) {
    throw run.error
  }
  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || `pymupdf exited with code ${run.status}`)
  }

  const content = run.stdout || ''
  return { content, mimeType: 'text/markdown' }
}

function cleanup(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Inspect PDF text density: returns text_pages / total_pages.
 */
export function inspectPdfWithPyMuPDF(buffer: Buffer, fileName: string): PdfInspection {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'pymupdf-inspect-'))
  const inputPath = path.join(tmpDir, fileName || 'input.pdf')
  writeFileSync(inputPath, buffer)

  const pyBin = process.env.PYMUPDF_PYTHON || 'py'
  const pyArgs = (process.env.PYMUPDF_PYTHON_ARGS || '-3.11').split(/\s+/).filter(Boolean)
  const timeout = parseInt(process.env.PYMUPDF_TIMEOUT_MS || '180000', 10)
  const threshold = parseInt(process.env.PYMUPDF_TEXT_THRESHOLD || '50', 10)

const pythonCode = `
import sys, json
import fitz

doc = fitz.open(sys.argv[1])
text_pages = 0
total_pages = 0
for p in doc:
    total_pages += 1
    txt = (p.get_text("text") or "").strip()
    if len(txt) > ${threshold}:
        text_pages += 1
doc.close()
print(json.dumps({"total_pages": total_pages, "text_pages": text_pages}))
`
  const run = spawnSync(pyBin, [...pyArgs, '-c', pythonCode, inputPath], {
    timeout,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })

  cleanup(tmpDir)

  if (run.error) throw run.error
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || `pymupdf inspect exited ${run.status}`)

  return parseJSON<PdfInspection>(run.stdout.trim())
}

/**
 * Render PDF pages to PNG data URLs.
 */
export function renderPdfToImages(buffer: Buffer, fileName: string): PageImage[] {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'pymupdf-img-'))
  const inputPath = path.join(tmpDir, fileName || 'input.pdf')
  writeFileSync(inputPath, buffer)

  const pyBin = process.env.PYMUPDF_PYTHON || 'py'
  const pyArgs = (process.env.PYMUPDF_PYTHON_ARGS || '-3.11').split(/\s+/).filter(Boolean)
  const timeout = parseInt(process.env.PYMUPDF_TIMEOUT_MS || '180000', 10)
  const scale = parseFloat(process.env.PYMUPDF_IMAGE_SCALE || '2')
  const maxPages = parseInt(process.env.PYMUPDF_IMAGE_MAX_PAGES || '0', 10)
  const { format, jpegQuality } = resolveImageFormat()

  const pythonCode = `
import sys, json, base64
import fitz

fmt = "${format}"
quality = ${jpegQuality}

doc = fitz.open(sys.argv[1])
out = []
for p in doc:
    if ${maxPages} > 0 and p.number >= ${maxPages}:
        break
    pix = p.get_pixmap(matrix=fitz.Matrix(${scale}, ${scale}), alpha=False)
    if fmt == "jpeg":
        try:
            img = pix.tobytes("jpeg", quality=quality)
        except TypeError:
            img = pix.tobytes("jpeg")
        mime = "image/jpeg"
    else:
        img = pix.tobytes("png")
        mime = "image/png"
    b64 = base64.b64encode(img).decode("ascii")
    out.append({"page": p.number + 1, "dataUrl": "data:" + mime + ";base64," + b64, "mimeType": mime})
print(json.dumps(out))
`

  const run = spawnSync(pyBin, [...pyArgs, '-c', pythonCode, inputPath], {
    timeout,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 128 * 1024 * 1024,
  })

  cleanup(tmpDir)

  if (run.error) throw run.error
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || `pymupdf render exited ${run.status}`)

  return parseJSON<PageImage[]>(run.stdout.trim())
}

function getPdfPageCountFromPath(
  inputPath: string,
  pyBin: string,
  pyArgs: string[],
  timeout: number
): number {
  const pythonCode = `
import sys
import fitz

doc = fitz.open(sys.argv[1])
print(doc.page_count)
`
  const run = spawnSync(pyBin, [...pyArgs, '-c', pythonCode, inputPath], {
    timeout,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })

  if (run.error) throw run.error
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || `pymupdf count exited ${run.status}`)

  const total = parseInt((run.stdout || '').trim(), 10)
  return Number.isFinite(total) ? total : 0
}

function renderPdfPageToImageFromPath(
  inputPath: string,
  pageIndex: number,
  scale: number,
  format: 'png' | 'jpeg',
  jpegQuality: number,
  pyBin: string,
  pyArgs: string[],
  timeout: number
): PageImage {
  const pythonCode = `
import sys, json, base64
import fitz

fmt = "${format}"
quality = ${jpegQuality}

doc = fitz.open(sys.argv[1])
page_index = int(sys.argv[2])
page = doc.load_page(page_index)
pix = page.get_pixmap(matrix=fitz.Matrix(${scale}, ${scale}), alpha=False)
if fmt == "jpeg":
    try:
        img = pix.tobytes("jpeg", quality=quality)
    except TypeError:
        img = pix.tobytes("jpeg")
    mime = "image/jpeg"
else:
    img = pix.tobytes("png")
    mime = "image/png"
b64 = base64.b64encode(img).decode("ascii")
print(json.dumps({"page": page.number + 1, "dataUrl": "data:" + mime + ";base64," + b64, "mimeType": mime}))
`
  const run = spawnSync(pyBin, [...pyArgs, '-c', pythonCode, inputPath, String(pageIndex)], {
    timeout,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 64 * 1024 * 1024,
  })

  if (run.error) throw run.error
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || `pymupdf page render exited ${run.status}`)

  return parseJSON<PageImage>((run.stdout || '').trim())
}

function renderPdfPageToImageFileFromPath(
  inputPath: string,
  pageIndex: number,
  scale: number,
  outputPath: string,
  format: 'png' | 'jpeg',
  jpegQuality: number,
  pyBin: string,
  pyArgs: string[],
  timeout: number
): PageImage {
  const pythonCode = `
import sys
import fitz

fmt = "${format}"
quality = ${jpegQuality}

doc = fitz.open(sys.argv[1])
page_index = int(sys.argv[2])
output_path = sys.argv[3]
page = doc.load_page(page_index)
pix = page.get_pixmap(matrix=fitz.Matrix(${scale}, ${scale}), alpha=False)
if fmt == "jpeg":
    try:
        img = pix.tobytes("jpeg", quality=quality)
    except TypeError:
        img = pix.tobytes("jpeg")
else:
    img = pix.tobytes("png")
with open(output_path, "wb") as f:
    f.write(img)
`

  const run = spawnSync(pyBin, [...pyArgs, '-c', pythonCode, inputPath, String(pageIndex), outputPath], {
    timeout,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })

  if (run.error) throw run.error
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || `pymupdf page render exited ${run.status}`)

  return { page: pageIndex + 1, filePath: outputPath }
}

/**
 * Stream PDF pages to images one by one to reduce peak memory.
 */
export async function* renderPdfToImagesStream(
  buffer: Buffer,
  fileName: string,
  totalPagesHint?: number
): AsyncGenerator<PageImage> {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'pymupdf-img-'))
  const inputPath = path.join(tmpDir, fileName || 'input.pdf')
  writeFileSync(inputPath, buffer)

  const pyBin = process.env.PYMUPDF_PYTHON || 'py'
  const pyArgs = (process.env.PYMUPDF_PYTHON_ARGS || '-3.11').split(/\s+/).filter(Boolean)
  const timeout = parseInt(process.env.PYMUPDF_TIMEOUT_MS || '180000', 10)
  const scale = parseFloat(process.env.PYMUPDF_IMAGE_SCALE || '2')
  const maxPages = parseInt(process.env.PYMUPDF_IMAGE_MAX_PAGES || '0', 10)
  const streamMode = (process.env.PYMUPDF_IMAGE_STREAM_MODE || 'dataurl').toLowerCase()
  const useFileStream = streamMode === 'file' || streamMode === 'filepath'
  const { format, mimeType, extension, jpegQuality } = resolveImageFormat()
  const debugDir = process.env.PYMUPDF_IMAGE_DEBUG_DIR?.trim()
  const baseName = path.basename(fileName || 'input', path.extname(fileName || 'input'))
  const debugOutputDir = debugDir ? path.join(debugDir, `${baseName}-${Date.now()}`) : ''

  try {
    if (debugOutputDir) {
      mkdirSync(debugOutputDir, { recursive: true })
      console.log(`[PARSER] PYMUPDF debug images: ${debugOutputDir}`)
    }

    const totalPages =
      typeof totalPagesHint === 'number' && Number.isFinite(totalPagesHint)
        ? totalPagesHint
        : getPdfPageCountFromPath(inputPath, pyBin, pyArgs, timeout)
    const pageLimit = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages

    for (let pageIndex = 0; pageIndex < pageLimit; pageIndex += 1) {
      if (useFileStream) {
        const outputDir = debugOutputDir || tmpDir
        const outputPath = path.join(outputDir, `page-${pageIndex + 1}.${extension}`)
        const image = renderPdfPageToImageFileFromPath(
          inputPath,
          pageIndex,
          scale,
          outputPath,
          format,
          jpegQuality,
          pyBin,
          pyArgs,
          timeout
        )
        image.mimeType = mimeType
        try {
          yield image
        } finally {
          if (!debugOutputDir) {
            try {
              rmSync(outputPath, { force: true })
            } catch {
              // ignore cleanup errors
            }
          }
        }
      } else {
        yield renderPdfPageToImageFromPath(
          inputPath,
          pageIndex,
          scale,
          format,
          jpegQuality,
          pyBin,
          pyArgs,
          timeout
        )
      }
    }
  } finally {
    cleanup(tmpDir)
  }
}
