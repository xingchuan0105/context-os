import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

import { parseWithPyMuPDF } from '../lib/parsers/pymupdf'

/**
 * Batch convert PDFs to Markdown using PyMuPDF.
 * Example:
 *   PYMUPDF_PYTHON=py PYMUPDF_PYTHON_ARGS="-3.11" npx ts-node scripts/parse-with-pymupdf.ts
 */
async function main() {
  const targets = ['test.pdf', 'test2.pdf', 'test3.pdf']

  for (const file of targets) {
    const abs = path.resolve(process.cwd(), file)
    console.log(`Parsing ${abs} ...`)

    const buffer = readFileSync(abs)
    const { content } = parseWithPyMuPDF(buffer, path.basename(abs))

    const outPath = path.resolve(process.cwd(), `${path.parse(file).name}.md`)
    writeFileSync(outPath, content, 'utf-8')
    console.log(`-> written: ${outPath}`)
  }
}

main().catch((err) => {
  console.error('PyMuPDF batch parse failed:', err)
  process.exitCode = 1
})
