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

/** Global Lightning singleton — only ONE Lightning can be live across the
 *  whole platform at a time. `product` scopes visibility on the student side. */
export interface LightningState {
  status: "inactive" | "live" | "expired";
  challenge_id: string | null;
  product: FlashProductId | null;
  activated_at: string | null;
  expires_at: string | null;
  duration_hours: number;
  accepted_student_ids: string[];
}

export const LIGHTNING_DEFAULT_HOURS = 24;
export const LIGHTNING_EXPIRED_VISIBLE_MS = 24 * 60 * 60 * 1000;

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
export const LIGHTNING_KEY = "verbo:flash-lightning";
export const LIGHTNING_EVENT = "verbo:flash-lightning-updated";

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

/* -------------------- Lightning (singleton) -------------------- */

const LIGHTNING_INACTIVE: LightningState = {
  status: "inactive",
  challenge_id: null,
  product: null,
  activated_at: null,
  expires_at: null,
  duration_hours: LIGHTNING_DEFAULT_HOURS,
  accepted_student_ids: [],
};

export function loadLightning(): LightningState {
  if (typeof window === "undefined") return { ...LIGHTNING_INACTIVE };
  try {
    const raw = localStorage.getItem(LIGHTNING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LightningState;
      // Auto-transition to expired based on wall clock; write-back if it flipped.
      if (parsed.status === "live" && parsed.expires_at && Date.now() >= +new Date(parsed.expires_at)) {
        const expired: LightningState = { ...parsed, status: "expired" };
        try { localStorage.setItem(LIGHTNING_KEY, JSON.stringify(expired)); } catch { /* noop */ }
        return expired;
      }
      return parsed;
    }
  } catch { /* noop */ }
  return { ...LIGHTNING_INACTIVE };
}

export function persistLightning(state: LightningState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIGHTNING_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(LIGHTNING_EVENT));
  } catch { /* noop */ }
}

export function subscribeLightning(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === LIGHTNING_KEY) cb(); };
  window.addEventListener(LIGHTNING_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LIGHTNING_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function activateLightning(
  challengeId: string,
  product: FlashProductId,
  durationHours: number,
): LightningState {
  const now = new Date();
  const expires = new Date(now.getTime() + Math.max(1, durationHours) * 60 * 60 * 1000);
  const state: LightningState = {
    status: "live",
    challenge_id: challengeId,
    product,
    activated_at: now.toISOString(),
    expires_at: expires.toISOString(),
    duration_hours: durationHours,
    accepted_student_ids: [],
  };
  persistLightning(state);
  return state;
}

export function endLightningEarly(): void {
  const cur = loadLightning();
  if (cur.status !== "live") return;
  persistLightning({ ...cur, status: "expired", expires_at: new Date().toISOString() });
}

export function acceptLightning(studentId: string): void {
  const cur = loadLightning();
  if (cur.status !== "live") return;
  if (cur.accepted_student_ids.includes(studentId)) return;
  persistLightning({ ...cur, accepted_student_ids: [...cur.accepted_student_ids, studentId] });
}

/** Returns true while the current Lightning state should still render for
 *  students — either it's live, or it expired within the visible-after
 *  window. Beyond that, the student card is hidden. */
export function isLightningVisibleForStudents(state: LightningState): boolean {
  if (state.status === "live") return true;
  if (state.status === "expired" && state.expires_at) {
    return Date.now() - +new Date(state.expires_at) < LIGHTNING_EXPIRED_VISIBLE_MS;
  }
  return false;
}
