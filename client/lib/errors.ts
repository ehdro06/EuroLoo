// Extracts a user-facing message from an RTK Query / fetch error.
// NestJS returns `{ message: string | string[] }` in the error body.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const data = (err as { data?: { message?: unknown } }).data
    const message = data?.message ?? (err as { message?: unknown }).message
    if (Array.isArray(message)) return message.join(", ")
    if (typeof message === "string" && message.length > 0) return message
  }
  return fallback
}
