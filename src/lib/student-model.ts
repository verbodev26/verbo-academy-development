// ============================================================================
// Student commercial model — single source of truth for the Admin > Students UI.
// Three independent axes: Product · Focus (Enfoque) · Access Plan.
// Everything here is meant to be easy to edit once the real catalog lands.
// ============================================================================

export type ProductId = "enterprise" | "go" | "international";
export type AccessPlanId = "Core" | "Advance" | "Elite" | "Signature";
export type StudentStatus = "active" | "suspended" | "frozen";

// Roughly one live session per unit; a level block = 30 units = 30 sessions.
export const SESSIONS_PER_LEVEL = 30;
export const MAX_INSIGHT_STRIKES = 3;

// ----------------------------------------------------------------------------
// PRODUCTS — audience + content roadmap. `icon` maps to a lucide-react name.
// ----------------------------------------------------------------------------
export interface ProductDef {
  id: ProductId;
  name: string;
  icon: "briefcase" | "compass" | "globe";
  blurb: string;
  hasFocus: boolean;
  defaultAccessPlan?: AccessPlanId; // auto-selected (still editable)
  // Commercial names for each 30-session level block (placeholders — edit later).
  levels: string[];
}

export const PRODUCTS: ProductDef[] = [
  {
    id: "enterprise",
    name: "Enterprise",
    icon: "briefcase",
    blurb: "Corporate training with a strategic roadmap.",
    hasFocus: false,
    defaultAccessPlan: undefined, // admin chooses freely
    levels: ["Core Foundations", "Strategic Fluency", "Executive Presence", "Global Leadership"],
  },
  {
    id: "go",
    name: "GO",
    icon: "compass",
    blurb: "Flexible everyday learning for individuals.",
    hasFocus: true,
    defaultAccessPlan: "Core",
    levels: ["Kickstart", "Everyday Flow", "Confident Voice", "Culture Master"],
  },
  {
    id: "international",
    name: "International",
    icon: "globe",
    blurb: "Goal-driven programs for travel & relocation.",
    hasFocus: true,
    defaultAccessPlan: "Advance",
    levels: ["Survival Basics", "Travel Ready", "Social Fluency", "Full Command"],
  },
];

export function getProduct(id?: string | null): ProductDef | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

// ----------------------------------------------------------------------------
// FOCUS (Enfoque) — marketing sub-offer. Only GO & International have it.
// `suggestedLevels` pre-marks the roadmap selection.
// ----------------------------------------------------------------------------
export interface FocusDef {
  id: string;
  name: string;
  product: ProductId;
  suggestedLevels: number; // how many roadmap levels to pre-select
}

export const FOCUSES: FocusDef[] = [
  { id: "go-global", name: "Experiencia Global", product: "go", suggestedLevels: 2 },
  { id: "go-hobby", name: "Hobby y Cultura", product: "go", suggestedLevels: 2 },
  { id: "intl-survival", name: "Supervivencia", product: "international", suggestedLevels: 2 },
  { id: "intl-mastery", name: "Dominio", product: "international", suggestedLevels: 4 },
];

export function focusesForProduct(product?: string | null): FocusDef[] {
  return FOCUSES.filter((f) => f.product === product);
}

export function getFocus(name?: string | null): FocusDef | undefined {
  return FOCUSES.find((f) => f.name === name);
}

// ----------------------------------------------------------------------------
// ACCESS PLANS — service tier (benefits, rescheduling, personalization).
// ----------------------------------------------------------------------------
export interface AccessPlanDef {
  id: AccessPlanId;
  blurb: string;
  reschedulePolicy: string; // preset label used in the reschedule dropdown
  rescheduleHours: number | null; // null = no restriction
  reschedulePct: number | null;
}

export const ACCESS_PLANS: AccessPlanDef[] = [
  {
    id: "Core",
    blurb: "Core incluye 1 Insight/mes no acumulable y ventana de reagendamiento de 24h.",
    reschedulePolicy: "24h de anticipación, máx. 25% de sesiones del mes",
    rescheduleHours: 24,
    reschedulePct: 25,
  },
  {
    id: "Advance",
    blurb: "Advance incluye 2 Insights/mes no acumulables y ventana de reagendamiento de 12h.",
    reschedulePolicy: "12h de anticipación, máx. 40% de sesiones del mes",
    rescheduleHours: 12,
    reschedulePct: 40,
  },
  {
    id: "Elite",
    blurb: "Elite incluye 4 Insights/mes no acumulables y ventana de reagendamiento de 6h.",
    reschedulePolicy: "6h de anticipación, máx. 70% de sesiones del mes",
    rescheduleHours: 6,
    reschedulePct: 70,
  },
  {
    id: "Signature",
    blurb: "Signature incluye Insights ilimitados y reagendamiento sin restricción.",
    reschedulePolicy: "Sin restricción",
    rescheduleHours: null,
    reschedulePct: null,
  },
];

export const ACCESS_PLAN_IDS: AccessPlanId[] = ["Core", "Advance", "Elite", "Signature"];

export function getAccessPlan(id?: string | null): AccessPlanDef | undefined {
  return ACCESS_PLANS.find((p) => p.id === id);
}

export const RESCHEDULE_PRESETS: string[] = ACCESS_PLANS.map((p) => p.reschedulePolicy);

// ----------------------------------------------------------------------------
// Session cadence helper — keep weekly minutes constant when frequency changes.
// ----------------------------------------------------------------------------
export function suggestDuration(prevPerWeek: number, prevDuration: number, nextPerWeek: number): number {
  if (nextPerWeek <= 0) return prevDuration;
  const weeklyMinutes = prevPerWeek * prevDuration;
  return Math.max(15, Math.round(weeklyMinutes / nextPerWeek / 5) * 5);
}

// ----------------------------------------------------------------------------
// Payment date helper — next occurrence of `paymentDay` from a reference date.
// ----------------------------------------------------------------------------
export function nextPaymentDate(paymentDay: number, from: Date = new Date()): Date {
  const day = Math.min(31, Math.max(1, paymentDay || 1));
  const candidate = new Date(from.getFullYear(), from.getMonth(), day);
  // Clamp to end of month if the month is shorter than `day`.
  if (candidate.getMonth() !== from.getMonth()) {
    candidate.setDate(0);
  }
  if (candidate.getTime() <= from.setHours(0, 0, 0, 0)) {
    const next = new Date(from.getFullYear(), from.getMonth() + 1, day);
    if (next.getDate() !== day) next.setDate(0);
    return next;
  }
  return candidate;
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}
