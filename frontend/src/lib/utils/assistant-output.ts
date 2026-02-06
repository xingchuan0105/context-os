export function stripAssistantMeta(text: string) {
  if (!text) return text
  // Remove model-evaluation tags like <ANSWER HELPFULNESS>...</ANSWER HELPFULNESS>
  const cleaned = text.replace(/<ANSWER\s+[^>]+>[\s\S]*?<\/ANSWER\s+[^>]+>/gi, '')
  return cleaned.replace(/^\s+/, '')
}
