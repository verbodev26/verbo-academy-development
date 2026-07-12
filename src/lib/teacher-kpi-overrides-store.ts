// ============================================================================
// Teacher KPI manual overrides — persistent record of one-off corrections
// approved by super_admin or coordinator_ops (coordinator_fin is intentionally
// excluded to keep separation of duties away from the bonus payout).
//
// An override rewrites a SPECIFIC month's snapshot for a single teacher, so
// bonus-streak recalculations can honour retroactive corrections. It does NOT
// change how future months are computed.
// ============================================================================
import { useSyncExternalStore } from "react";

export type KpiMetric =
  | "connectionPunctuality"
  | "planningPunctuality"
  | "completionRate"
  | "ratingNormalized"
  | "cancellationScore"
  | "responsiveness"
  | "composite";

export const KPI_METRIC_LABELS: Record<KpiMetric, string> = {
  connectionPunctuality: "Connection punctuality",
  planningPunctuality: "Planning punctuality",
  completionRate: "Session completion rate",
  ratingNormalized: "Student rating",
  cancellationScore: "Cancellations / No-Shows",
  responsiveness: "Reschedule/Substitute Responsiveness",
  composite: "Composite score",
};

export interface KpiOverride {
  id: string;
  teacher_id: string;
  month_key: string;          // "YYYY-MM"
  metric: KpiMetric;
  previous_value: number;
  new_value: number;
  justification: string;
  evidence_name?: string;     // filename only for now (no storage backend)
  admin_id: string;
  admin_name: string;         // signature
  created_at: string;         // ISO
}

export const KPI_OVERRIDES_KEY = "verbo:kpi-overrides";
export const KPI_OVERRIDES_EVENT = "verbo:kpi-overrides-updated";

// ----- Persistence ---------------------------------------------------------
export function loadKpiOverrides(): KpiOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KPI_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as KpiOverride[]) : [];
  } catch {
    return [];
  }
}

function persist(list: KpiOverride[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KPI_OVERRIDES_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(KPI_OVERRIDES_EVENT));
  } catch {
    /* noop */
  }
}

export function subscribeKpiOverrides(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === KPI_OVERRIDES_KEY) cb(); };
  window.addEventListener(KPI_OVERRIDES_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(KPI_OVERRIDES_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

// ----- Mutations -----------------------------------------------------------
export function addKpiOverride(input: Omit<KpiOverride, "id" | "created_at">): KpiOverride {
  const entry: KpiOverride = {
    ...input,
    id: `kpio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };
  persist([entry, ...loadKpiOverrides()]);
  return entry;
}

// ----- Queries -------------------------------------------------------------
export function overridesFor(teacherId: string): KpiOverride[] {
  return loadKpiOverrides().filter((o) => o.teacher_id === teacherId);
}

/** Latest override for a given (teacher, month, metric) — winning value. */
export function latestOverride(
  teacherId: string,
  monthKey: string,
  metric: KpiMetric,
): KpiOverride | null {
  const list = loadKpiOverrides()
    .filter((o) => o.teacher_id === teacherId && o.month_key === monthKey && o.metric === metric)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return list[0] ?? null;
}

/** All overrides that apply to a given (teacher, month), latest per metric. */
export function overridesForMonth(teacherId: string, monthKey: string): Record<KpiMetric, KpiOverride | undefined> {
  const out = {} as Record<KpiMetric, KpiOverride | undefined>;
  for (const o of loadKpiOverrides()) {
    if (o.teacher_id !== teacherId || o.month_key !== monthKey) continue;
    const prev = out[o.metric];
    if (!prev || +new Date(o.created_at) > +new Date(prev.created_at)) out[o.metric] = o;
  }
  return out;
}

// ----- React binding -------------------------------------------------------
export function useKpiOverrides(): KpiOverride[] {
  return useSyncExternalStore(
    (cb) => subscribeKpiOverrides(cb),
    () => loadKpiOverrides(),
    () => [],
  );
}
