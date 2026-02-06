export function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${(err as Error).message}\nraw=${raw?.slice(0, 2000)}`)
  }
}
