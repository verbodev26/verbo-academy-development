// Verbo Flash catalog — complementary "surprise" challenges independent from
// the weekly Challenges bank. Same persistence pattern as challenges-store.ts:
// localStorage + a broadcast CustomEvent so any open tab refreshes in real
// time. Categories/colors are reused from challenges-store via categoryColor().

export type FlashFormat = "mystery_box" | "lightning" | "season";

export type FlashProductId = "enterprise" | "go" | "international";

export interface FlashChallenge {
  id: string; // e.g. MYSTERY-ENTERPRISE-1
  format: FlashFormat;
  product: FlashProductId;
  category: string;
  title: string;
  description: string;
  video_url?: string;
  premium?: boolean;
  skill_tags?: string[];
}

export interface FlashConfig {
  box_art_url?: string;
}

export const FLASH_PRODUCT_ORDER: FlashProductId[] = ["enterprise", "go", "international"];
export const FLASH_PRODUCT_LABEL: Record<FlashProductId, string> = {
  enterprise: "Enterprise",
  go: "GO",
  international: "International",
};

export const FLASH_KEY = "verbo:flash-challenges";
export const FLASH_EVENT = "verbo:flash-challenges-updated";
export const FLASH_CONFIG_KEY = "verbo:flash-config";
export const FLASH_CONFIG_EVENT = "verbo:flash-config-updated";

/* -------------------- Challenges -------------------- */

export function loadFlashChallenges(): FlashChallenge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FLASH_KEY);
    if (raw) return JSON.parse(raw) as FlashChallenge[];
  } catch { /* noop */ }
  return [];
}

export function persistFlashChallenges(list: FlashChallenge[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FLASH_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(FLASH_EVENT));
  } catch { /* noop */ }
}

export function subscribeFlashChallenges(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === FLASH_KEY) cb(); };
  window.addEventListener(FLASH_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FLASH_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

function flashNum(id: string): number {
  const m = id.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export function newFlashChallengeId(
  format: FlashFormat,
  product: FlashProductId,
  existing: FlashChallenge[],
): string {
  const prefix = `${format.toUpperCase().replace("_", "-")}-${product.toUpperCase()}`;
  const max = existing
    .filter((c) => c.format === format && c.product === product)
    .reduce((m, c) => Math.max(m, flashNum(c.id)), 0);
  return `${prefix}-${max + 1}`;
}

export function flashChallengesFor(
  list: FlashChallenge[],
  format: FlashFormat,
  product: FlashProductId,
): FlashChallenge[] {
  return list
    .filter((c) => c.format === format && c.product === product)
    .sort((a, b) => flashNum(a.id) - flashNum(b.id));
}

/* -------------------- Config (box art, etc.) -------------------- */

export function loadFlashConfig(): FlashConfig {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FLASH_CONFIG_KEY);
    if (raw) return JSON.parse(raw) as FlashConfig;
  } catch { /* noop */ }
  return {};
}

export function persistFlashConfig(cfg: FlashConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FLASH_CONFIG_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent(FLASH_CONFIG_EVENT));
  } catch { /* noop */ }
}

export function subscribeFlashConfig(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === FLASH_CONFIG_KEY) cb(); };
  window.addEventListener(FLASH_CONFIG_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FLASH_CONFIG_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
