import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const STUDIO_COOKIE = "majestic_studio";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function isStudioPasswordConfigured() {
  return Boolean(process.env.STUDIO_PASSWORD);
}

export function studioCookieValue() {
  const password = process.env.STUDIO_PASSWORD ?? "";
  return password ? digest(`majestic:${password}`) : "";
}

export function verifyStudioPassword(input: string) {
  const expected = process.env.STUDIO_PASSWORD ?? "";
  if (!expected || !input) return false;

  const a = Buffer.from(digest(input));
  const b = Buffer.from(digest(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isStudioAuthenticated() {
  if (!isStudioPasswordConfigured()) return false;
  const store = await cookies();
  const current = store.get(STUDIO_COOKIE)?.value ?? "";
  const expected = studioCookieValue();
  if (!current || !expected) return false;

  const a = Buffer.from(current);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
