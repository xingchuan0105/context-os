export function extractContentFromMarkdown(markdown: string): string {
  const marker = '## Content'
  const index = markdown.indexOf(marker)
  if (index === -1) {
    return markdown.trim()
  }
  return markdown.slice(index + marker.length).trim()
}
