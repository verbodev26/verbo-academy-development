// Material Complementario store — single source of truth shared by
// Admin (management) and the Student/Teacher panels (read views).
// Persisted to localStorage and broadcast via a custom event so every open
// route updates in real-time. Seeded from the mock MATERIALS catalog.
import { useSyncExternalStore } from "react";
import { MATERIALS, type MaterialType } from "./mock-data";

export type RestrictProduct = "go" | "enterprise" | "international";

export interface StoredMaterial {
  id: string;
  title: string;
  material_type: MaterialType;
  category: string;
  upload_url: string;
  cover_image?: string; // dataURL (uploaded) — empty means use type fallback
  restrict_product?: RestrictProduct; // undefined = visible to everyone
  restrict_level?: string; // commercial level name (depends on product)
}

// Restrict-to catalog — GO / Enterprise / International (VIP excluded here).
export const RESTRICT_PRODUCTS: { id: RestrictProduct; label: string; levels: string[] }[] = [
  { id: "go", label: "GO", levels: ["Kickstart", "Everyday Flow", "Confident Voice", "Culture Master"] },
  { id: "enterprise", label: "Enterprise", levels: ["Core Foundations", "Strategic Fluency", "Executive Presence", "Global Leadership"] },
  { id: "international", label: "International", levels: ["Survival Basics", "Travel Ready", "Social Fluency", "Full Command"] },
];

export function levelsForProduct(product?: RestrictProduct | ""): string[] {
  return RESTRICT_PRODUCTS.find((p) => p.id === product)?.levels ?? [];
}

const MATERIALS_KEY = "verbo:materials";
const CATEGORIES_KEY = "verbo:material-categories";
export const MATERIALS_EVENT = "verbo:materials-updated";

const SEED_CATEGORIES = ["Grammar", "Vocabulary", "Business", "Speaking"];

function safeRead<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(k, JSON.stringify(v));
    invalidateCache();
    window.dispatchEvent(new CustomEvent(MATERIALS_EVENT));
  } catch {
    /* noop */
  }
}

// Cached snapshots so useSyncExternalStore gets a stable reference between
// store changes (a fresh array each read would trigger an infinite loop).
let matCache: StoredMaterial[] | null = null;
let catCache: string[] | null = null;
function invalidateCache() {
  matCache = null;
  catCache = null;
}

function seedMaterials(): StoredMaterial[] {
  return MATERIALS.map((m) => ({
    id: m.id,
    title: m.title,
    material_type: m.material_type,
    category: m.category,
    upload_url: m.upload_url,
  }));
}

export function loadMaterials(): StoredMaterial[] {
  if (typeof window === "undefined") return seedMaterials();
  const raw = localStorage.getItem(MATERIALS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as StoredMaterial[];
    } catch {
      /* noop */
    }
  }
  const initial = seedMaterials();
  safeWrite(MATERIALS_KEY, initial);
  return initial;
}

export function loadCategories(): string[] {
  if (typeof window === "undefined") return SEED_CATEGORIES;
  const raw = localStorage.getItem(CATEGORIES_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      /* noop */
    }
  }
  safeWrite(CATEGORIES_KEY, SEED_CATEGORIES);
  return SEED_CATEGORIES;
}

export function persistMaterials(items: StoredMaterial[]) {
  safeWrite(MATERIALS_KEY, items);
}

export function persistCategories(cats: string[]) {
  safeWrite(CATEGORIES_KEY, cats);
}

export function addCategory(name: string): string[] {
  const trimmed = name.trim();
  const cats = loadCategories();
  if (!trimmed || cats.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return cats;
  const next = [...cats, trimmed];
  persistCategories(next);
  return next;
}

export function upsertMaterial(mat: StoredMaterial) {
  const items = loadMaterials();
  const idx = items.findIndex((m) => m.id === mat.id);
  const next = idx >= 0 ? items.map((m) => (m.id === mat.id ? mat : m)) : [mat, ...items];
  persistMaterials(next);
}

export function deleteMaterial(id: string) {
  persistMaterials(loadMaterials().filter((m) => m.id !== id));
}

/** Materials a given student may see, honoring optional Restrict-to rules. */
export function visibleForStudent(
  items: StoredMaterial[],
  product?: string | null,
  level?: string | null,
): StoredMaterial[] {
  return items.filter((m) => {
    if (m.restrict_product && m.restrict_product !== product) return false;
    if (m.restrict_level && m.restrict_level !== level) return false;
    return true;
  });
}

// ---- React bindings -------------------------------------------------------
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === MATERIALS_KEY || e.key === CATEGORIES_KEY) cb();
  };
  window.addEventListener(MATERIALS_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MATERIALS_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMaterials(): StoredMaterial[] {
  return useSyncExternalStore(subscribe, loadMaterials, seedMaterials);
}

export function useCategories(): string[] {
  return useSyncExternalStore(subscribe, loadCategories, () => SEED_CATEGORIES);
}
