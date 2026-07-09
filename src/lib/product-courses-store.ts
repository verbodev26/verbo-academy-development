// Product-based course catalog — the source of truth for the Admin > Courses
// 3-level navigation: Product > Commercial Level > Units.
// Persisted to localStorage and broadcast via a custom event so any open
// tab/route updates in real-time. VIP is intentionally excluded here.

export type ProductId = "go" | "enterprise" | "international";

export interface CourseUnit {
  id: string; // e.g. GO-L1-U1
  title: string;
  video_url: string;
  pdf_url: string;
}

export interface CourseLevel {
  id: string; // e.g. GO-L1
  name: string;
  units: CourseUnit[];
}

export interface ProductCourse {
  product: ProductId;
  levels: CourseLevel[];
}

export const PRODUCT_META: Record<ProductId, { label: string; description: string }> = {
  go: { label: "GO", description: "Flexible general English for individual learners." },
  enterprise: { label: "Enterprise", description: "Corporate programs for teams and organizations." },
  international: { label: "International", description: "Survival & travel-focused English tracks." },
};

export const PRODUCT_ORDER: ProductId[] = ["go", "enterprise", "international"];

// Placeholder commercial level names — editable later.
const LEVEL_NAMES: Record<ProductId, string[]> = {
  go: ["Kickstart", "Everyday Flow", "Confident Voice", "Culture Master"],
  enterprise: ["Core Foundations", "Strategic Fluency", "Executive Presence", "Global Leadership"],
  international: ["Survival Basics", "Travel Ready", "Global Connector", "World Fluency"],
};

export const UNITS_PER_LEVEL = 30;

export const COURSES_KEY = "verbo:product-courses";
export const COURSES_EVENT = "verbo:product-courses-updated";

function seed(): ProductCourse[] {
  return PRODUCT_ORDER.map((product) => ({
    product,
    levels: LEVEL_NAMES[product].map((name, i) => ({
      id: `${PRODUCT_META[product].label.toUpperCase()}-L${i + 1}`,
      name,
      units: [],
    })),
  }));
}

export function loadCourses(): ProductCourse[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProductCourse[];
      // One-time migration: rename Enterprise L4 to "Global Leadership".
      let migrated = false;
      for (const p of parsed) {
        if (p.product === "enterprise") {
          for (const l of p.levels) {
            if (l.name === "Global Mastery") { l.name = "Global Leadership"; migrated = true; }
          }
        }
      }
      if (migrated) {
        try { localStorage.setItem(COURSES_KEY, JSON.stringify(parsed)); } catch { /* noop */ }
      }
      return parsed;
    }
  } catch { /* noop */ }
  const initial = seed();
  try { localStorage.setItem(COURSES_KEY, JSON.stringify(initial)); } catch { /* noop */ }
  return initial;
}

export function persistCourses(courses: ProductCourse[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
    window.dispatchEvent(new CustomEvent(COURSES_EVENT));
  } catch { /* noop */ }
}

export function subscribeCourses(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === COURSES_KEY) cb(); };
  window.addEventListener(COURSES_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(COURSES_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Build the 30 empty units for a level: 9 content + 1 review, x3 blocks. */
export function buildSkeletonUnits(levelId: string, startAt = 1): CourseUnit[] {
  const units: CourseUnit[] = [];
  for (let i = startAt; i <= UNITS_PER_LEVEL; i++) {
    const isReview = i % 10 === 0;
    const title = isReview ? `Review ${i / 10}` : `Unit ${i}`;
    units.push({ id: `${levelId}-U${i}`, title, video_url: "", pdf_url: "" });
  }
  return units;
}
