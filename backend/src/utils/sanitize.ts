// ── Sanitize & Validate helpers ──────────────────────────────────────────────

/** Strip HTML tags and control chars, then trim. */
export function sanitizeStr(val: unknown, maxLen = 255): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLen);
}

/** Return a number clamped to [min, max] or null if not a finite number. */
export function sanitizeNumber(val: unknown, min: number, max: number): number | null {
  const n = Number(val);
  if (!isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Return the value if it is in the allowed set, otherwise null. */
export function sanitizeEnum<T extends string>(val: unknown, allowed: readonly T[]): T | null {
  if (typeof val === "string" && (allowed as readonly string[]).includes(val)) return val as T;
  return null;
}

/** Return true if string is a valid HH:MM time. */
export function isValidTime(val: unknown): boolean {
  return typeof val === "string" && /^\d{2}:\d{2}$/.test(val);
}

/** Return true if string is a valid YYYY-MM-DD date. */
export function isValidDate(val: unknown): boolean {
  return typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

/** Password strength: min 8 chars, at least one lowercase, uppercase, digit. */
export function isStrongPassword(val: unknown): boolean {
  if (typeof val !== "string" || val.length < 8) return false;
  return /[a-z]/.test(val) && /[A-Z]/.test(val) && /[0-9]/.test(val);
}
