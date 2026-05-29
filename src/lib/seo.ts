export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>')
}
