import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  USERS, SESSIONS, ASSIGNMENTS, userById, type User,
} from "@/lib/mock-data";
import {
  PRODUCTS, FOCUSES, ACCESS_PLANS, ACCESS_PLAN_IDS, RESCHEDULE_PRESETS,
  SESSIONS_PER_LEVEL, MAX_INSIGHT_STRIKES, MAX_BOOKCLUB_STRIKES,
  getProduct, focusesForProduct, getFocus, getAccessPlan,
  suggestDuration, nextPaymentDate, daysUntil,
  type ProductId, type AccessPlanId,
} from "@/lib/student-model";
import { teachersForProduct } from "@/lib/teacher-model";
import { Card, GhostButton, PrimaryButton } from "@/components/verbo/ui";
import { useAvatar } from "@/lib/avatar-store";
import {
  Plus, X, Eye, EyeOff, KeyRound, Mail, Building2, CalendarDays, GraduationCap,
  Users, Briefcase, Compass, Globe, Crown, Copy, Check, Snowflake, Ban, Play, Unlock,
  Sparkles, Wand2, Pencil, Video, Repeat, Clock, CreditCard, ShieldAlert,
  Search, ArrowUpDown, Filter, Gauge, Lightbulb, Layers,
} from "lucide-react";
import {
  type WorkshopCohort, type WorkshopTemplate,
  addStudentToCohort, cohortsForStudent, loadWorkshops,
  removeParticipantFromCohort, subscribeWorkshops,
} from "@/lib/workshops-store";
import { groupsByStudentId, groupOfStudent, removeMember, subscribeGroups, type Group } from "@/lib/groups-store";

export const Route = createFileRoute("/admin/students")({
  component: Page,
  validateSearch: (s: Record<string, unknown>): { new?: boolean; student?: string } => ({
    new: s.new === true || s.new === "true" || s.new === "1",
    student: typeof s.student === "string" ? s.student : undefined,
  }),
});

// ---------------------------------------------------------------------------
// Persistence (localStorage — swap for Lovable Cloud later)
// ---------------------------------------------------------------------------
const PROFILE_KEY = "verbo:student-profile-overrides";
const REGISTERED_KEY = "verbo:registered-students";

function readProfileOverrides(): Record<string, Partial<User>> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); } catch { return {}; }
}
function writeProfileOverrides(map: Record<string, Partial<User>>) {
  if (typeof window !== "undefined") localStorage.setItem(PROFILE_KEY, JSON.stringify(map));
}
function readRegisteredStudents(): User[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(REGISTERED_KEY) || "[]"); } catch { return []; }
}
function writeRegisteredStudents(list: User[]) {
  if (typeof window !== "undefined") localStorage.setItem(REGISTERED_KEY, JSON.stringify(list));
}

const LEVEL_OPTIONS = [
  { value: "A1", label: "A1 — Beginner" },
  { value: "A2", label: "A2 — Elementary" },
  { value: "B1", label: "B1 — Intermediate" },
  { value: "B2", label: "B2 — Upper Intermediate" },
  { value: "C1", label: "C1 — Advanced" },
  { value: "C2", label: "C2 — Mastery" },
];

const PRODUCT_ICON = { briefcase: Briefcase, compass: Compass, globe: Globe, crown: Crown } as const;

const PRODUCT_TYPE_OPTIONS: {
  id: "performance" | "workshops" | "insights";
  name: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "performance", name: "Performance Sessions", blurb: "Live 1:1 English program (Enterprise, GO, International, VIP).", icon: Gauge },
  { id: "workshops", name: "Focus Workshops", blurb: "Short-form workshops only. No live 1:1 sessions.", icon: Layers },
  { id: "insights", name: "Insights", blurb: "Insights access only. No live sessions or workshops.", icon: Lightbulb },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function computeNextPayment(u: User): Date | null {
  if (u.next_payment) return new Date(u.next_payment);
  if (!u.payment_day) return null;
  // Always compute from today so the "next" payment stays forward-looking
  // even when cycle_start is old and the student has never been marked paid.
  return nextPaymentDate(u.payment_day, new Date());
}

// ===========================================================================
// PAGE
// ===========================================================================
function Page() {
  const { new: openNew, student: focusStudent } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [, forceTick] = useState(0);
  const [detail, setDetail] = useState<User | null>(null);
  const [formFor, setFormFor] = useState<User | "new" | null>(null);

  useEffect(() => {
    const overrides = readProfileOverrides();
    USERS.forEach((u) => { if (overrides[u.id]) Object.assign(u, overrides[u.id]); });
    readRegisteredStudents().forEach((u) => {
      if (!USERS.find((x) => x.id === u.id)) USERS.push(u);
    });
    forceTick((n) => n + 1);
  }, []);

  // Deep-link handling from the Admin Overview Quick Actions / snapshot links.
  useEffect(() => {
    if (openNew) {
      setFormFor("new");
      navigate({ search: {}, replace: true });
    } else if (focusStudent) {
      const s = USERS.find((u) => u.id === focusStudent && u.role === "student");
      if (s) setDetail(s);
      navigate({ search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew, focusStudent]);

  const allStudents = USERS.filter((u) => u.role === "student");
  // Group members also appear here as their own cards (read/manage individually);
  // creating/registering group members still happens under the Groups tab.
  const groupMap = groupsByStudentId();
  const teachers = USERS.filter((u) => u.role === "teacher");

  useEffect(() => subscribeGroups(() => forceTick((n) => n + 1)), []);

  // ---------------------------------------------------------------------------
  // Filter & search state
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "">("");
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterProduct, setFilterProduct] = useState<string>("");

  const companies = useMemo(() => {
    const set = new Set<string>();
    allStudents.forEach((s) => { if (s.company) set.add(s.company); });
    return Array.from(set).sort();
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    let list = allStudents.slice();

    // search by name
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }

    // filter by company
    if (filterCompany) {
      list = list.filter((s) => s.company === filterCompany);
    }

    // filter by product
    if (filterProduct) {
      list = list.filter((s) => s.product === filterProduct);
    }

    // sort
    if (sortBy === "name-asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      list.sort((a, b) => b.name.localeCompare(a.name));
    }

    return list;
  }, [allStudents, searchQuery, filterCompany, filterProduct, sortBy]);

  const persist = (updated: User) => {
    const idx = USERS.findIndex((u) => u.id === updated.id);
    if (idx >= 0) USERS[idx] = updated; else USERS.push(updated);
    const overrides = readProfileOverrides();
    const { id, name, role, ...rest } = updated;
    overrides[updated.id] = { name, ...rest };
    writeProfileOverrides(overrides);
    // keep registered list fresh if this is a locally-created student
    const registered = readRegisteredStudents();
    const rIdx = registered.findIndex((u) => u.id === updated.id);
    if (rIdx >= 0) { registered[rIdx] = updated; writeRegisteredStudents(registered); }
    forceTick((n) => n + 1);
  };

  const handleRegister = (u: User, teacherId?: string) => {
    USERS.push(u);
    if (teacherId) ASSIGNMENTS.push({ teacher_id: teacherId, student_id: u.id });
    const registered = readRegisteredStudents();
    registered.push(u);
    writeRegisteredStudents(registered);
    setFormFor(null);
    forceTick((n) => n + 1);
    setDetail(null);
  };

  const handleUpdate = (u: User, teacherId?: string) => {
    persist(u);
    if (teacherId) {
      const existing = ASSIGNMENTS.find((a) => a.student_id === u.id);
      if (existing) existing.teacher_id = teacherId;
      else ASSIGNMENTS.push({ teacher_id: teacherId, student_id: u.id });
    }
    setFormFor(null);
    // keep detail modal in sync
    setDetail((d) => (d && d.id === u.id ? u : d));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register, manage and monitor student memberships.</p>
        </div>
        <button
          onClick={() => setFormFor("new")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Register student
        </button>
      </div>

      {/* Filters & search bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name-asc" | "name-desc" | "")}
              className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Alphabetical order</option>
              <option value="name-asc">Name: A → Z</option>
              <option value="name-desc">Name: Z → A</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Company filter */}
          <div className="relative">
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Filter className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Product filter */}
          <div className="relative">
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All products</option>
              {PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Filter className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Clear filters */}
          {(searchQuery || sortBy || filterCompany || filterProduct) && (
            <button
              onClick={() => { setSearchQuery(""); setSortBy(""); setFilterCompany(""); setFilterProduct(""); }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredStudents.length} of {allStudents.length} students
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filteredStudents.map((s) => (
          <StudentCard key={s.id} student={s} onOpen={() => setDetail(s)} />
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center shadow-sm">
          <Search className="mb-3 h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground">No students found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters or search query.</p>
        </div>
      )}

      {detail && (
        <StudentDetailModal
          student={detail}
          teachers={teachers}
          onClose={() => setDetail(null)}
          onUpdate={handleUpdate}
          onEdit={() => { const s = detail; setDetail(null); setFormFor(s); }}
        />
      )}

      {formFor && (
        <StudentFormModal
          initial={formFor === "new" ? null : formFor}
          teachers={teachers}
          onClose={() => setFormFor(null)}
          onSave={formFor === "new" ? handleRegister : handleUpdate}
        />
      )}
    </div>
  );
}

// ===========================================================================
// STUDENT CARD
// ===========================================================================
function StudentCard({ student: s, onOpen }: { student: User; onOpen: () => void }) {
  const avatar = useAvatar(s.id);
  const product = getProduct(s.product);
  const groupInfo = groupOfStudent(s.id);
  const strikes = s.insights_strikes ?? 0;
  const blocked = strikes >= MAX_INSIGHT_STRIKES;
  const bcStrikes = s.bookclub_strikes ?? 0;
  const bcBlocked = bcStrikes >= MAX_BOOKCLUB_STRIKES;
  const hasBookClubs = (s.addon_bookclubs_per_month ?? 0) > 0;
  const hired = s.hired_sessions ?? 0;
  const remaining = s.remaining_sessions ?? 0;
  const done = Math.max(0, hired - remaining);
  const pct = hired > 0 ? (done / hired) * 100 : 0;

  const nextPay = computeNextPayment(s);
  const payDue = nextPay ? daysUntil(nextPay) <= 3 && daysUntil(nextPay) >= 0 : false;

  const statusBadge =
    s.status === "suspended" ? { cls: "bg-destructive/10 text-destructive", label: "Suspended" }
    : s.status === "frozen" ? { cls: "bg-blue-500/10 text-blue-600", label: "Frozen" }
    : { cls: "bg-success/10 text-success", label: "Active" };

  const productType = s.product_type ?? "performance";
  // Insights strike badge stays for anyone with Insights access — Performance
  // students (kept as before) and standalone Insights customers.
  const showInsightsBadge = productType === "performance" || productType === "insights";

  if (productType !== "performance") {
    const typeLabel = productType === "workshops" ? "Focus Workshops" : "Insights";
    return (
      <button
        onClick={onOpen}
        className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated"
      >
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt={s.name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials(s.name)}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{s.name}</div>
            <div className="truncate text-xs text-muted-foreground">{s.email}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Tag className="bg-primary/10 text-primary">{typeLabel}</Tag>
          <Tag className={statusBadge.cls}>{statusBadge.label}</Tag>
          {showInsightsBadge && (
            <Tag className={blocked ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}>
              {blocked ? <>Insights Blocked</> : <>Insights {strikes}/{MAX_INSIGHT_STRIKES}</>}
            </Tag>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className={`group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated ${payDue ? "verbo-pay-glow" : ""}`}
    >
      {payDue && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          <CreditCard className="h-3 w-3" /> Payment due
        </span>
      )}

      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt={s.name} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials(s.name)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{s.name}</div>
          {s.product === "enterprise" && s.company && (
            <div className="truncate text-xs text-muted-foreground">{s.company}</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {product && <Tag className="bg-primary/10 text-primary">{product.name}</Tag>}
        {s.access_plan && <Tag className="bg-accent/10 text-accent">{s.access_plan}</Tag>}
        {s.focus && <Tag className="bg-secondary text-secondary-foreground">{s.focus}</Tag>}
        {groupInfo && (
          <Tag className="bg-blue-500/10 text-blue-600">Group: {groupInfo.group.name}</Tag>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Sessions</span>
          <span className="font-medium text-foreground">{remaining}/{hired}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {s.current_roadmap_level && <Tag className="bg-muted text-muted-foreground">{s.current_roadmap_level}</Tag>}
        <Tag className={statusBadge.cls}>{statusBadge.label}</Tag>
        <Tag className={blocked ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}>
          {blocked ? <>Insights Blocked</> : <>Insights {strikes}/{MAX_INSIGHT_STRIKES}</>}
        </Tag>
        {hasBookClubs && (
          <Tag className={bcBlocked ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}>
            {bcBlocked ? <>Book Clubs Blocked</> : <>Book Clubs {bcStrikes}/{MAX_BOOKCLUB_STRIKES}</>}
          </Tag>
        )}
      </div>
    </button>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

// ===========================================================================
// REGISTER / EDIT FORM MODAL  (stepped card selection)
// ===========================================================================
type FormState = {
  name: string; email: string; password: string; member_since: string;
  company: string;
  product_type: "performance" | "workshops" | "insights";
  product: ProductId | "";
  focus: string;
  contracted_levels: string[];
  access_plan: AccessPlanId | "";
  current_level: string;
  hired_sessions: number; remaining_sessions: number; sessions_auto: boolean;
  sessions_per_week: number; session_duration: number;
  reschedule_policy: string; reschedule_custom_hours: number; reschedule_custom_pct: number;
  payment_day: number; cycle_start: string;
  video_call_link: string;
  teacher_id: string;
  // Add-ons
  addon_insights_per_month: number;
  addon_bookclubs_per_month: number;
  addon_spotlight_per_month: number;
  addon_workshops_enabled: boolean;
  selected_cohort_ids: string[];
};

function StudentFormModal({
  initial, teachers, onClose, onSave,
}: {
  initial: User | null;
  teachers: User[];
  onClose: () => void;
  onSave: (u: User, teacherId?: string) => void;
}) {
  const editing = !!initial;
  const existingTeacher = initial ? ASSIGNMENTS.find((a) => a.student_id === initial.id)?.teacher_id ?? "" : "";

  const [f, setF] = useState<FormState>(() => ({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    password: initial?.password ?? "",
    member_since: initial?.member_since ?? "",
    company: initial?.company ?? "",
    product_type: (initial?.product_type as FormState["product_type"]) ?? "performance",
    product: (initial?.product as ProductId) ?? "",
    focus: initial?.focus ?? "",
    contracted_levels: initial?.contracted_levels ?? [],
    access_plan: (initial?.access_plan as AccessPlanId) ?? "",
    current_level: initial?.current_level ?? "",
    hired_sessions: initial?.hired_sessions ?? 0,
    remaining_sessions: initial?.remaining_sessions ?? 0,
    sessions_auto: initial?.sessions_auto ?? true,
    sessions_per_week: initial?.sessions_per_week ?? 2,
    session_duration: initial?.session_duration ?? 60,
    reschedule_policy: initial?.reschedule_policy ?? "",
    reschedule_custom_hours: initial?.reschedule_custom_hours ?? 24,
    reschedule_custom_pct: initial?.reschedule_custom_pct ?? 25,
    payment_day: initial?.payment_day ?? 1,
    cycle_start: initial?.cycle_start ?? "",
    video_call_link: initial?.video_call_link ?? "",
    teacher_id: existingTeacher,
    addon_insights_per_month: initial?.addon_insights_per_month ?? 0,
    addon_bookclubs_per_month: initial?.addon_bookclubs_per_month ?? 0,
    addon_spotlight_per_month: initial?.addon_spotlight_per_month ?? 0,
    addon_workshops_enabled: initial?.addon_workshops_enabled ?? false,
    selected_cohort_ids: initial ? cohortsForStudent(initial.id).map((x) => x.cohort.id) : [],
  }));
  const [showPassword, setShowPassword] = useState(false);
  const prevPerWeek = useRef(f.sessions_per_week);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const product = getProduct(f.product);
  const isEnterprise = f.product === "enterprise";
  const productLevels = product?.levels ?? [];

  // --- Product change: reset dependent axes ---
  const pickProduct = (id: ProductId) => {
    const p = getProduct(id)!;
    setF((prev) => ({
      ...prev,
      product: id,
      focus: "",
      company: id === "enterprise" ? prev.company : "",
      contracted_levels: [],
      access_plan: p.defaultAccessPlan ?? "",
      reschedule_policy: getAccessPlan(p.defaultAccessPlan)?.reschedulePolicy ?? "",
      hired_sessions: 0,
      remaining_sessions: 0,
      sessions_auto: true,
    }));
  };

  // --- Focus change: pre-mark suggested levels ---
  const pickFocus = (name: string) => {
    const focus = getFocus(name);
    const n = focus?.suggestedLevels ?? 0;
    const preset = productLevels.slice(0, n);
    setF((prev) => {
      const hired = preset.length * SESSIONS_PER_LEVEL;
      return {
        ...prev, focus: name, contracted_levels: preset,
        ...(prev.sessions_auto ? { hired_sessions: hired, remaining_sessions: editing ? prev.remaining_sessions : hired } : {}),
      };
    });
  };

  const toggleLevel = (lvl: string) => {
    setF((prev) => {
      const has = prev.contracted_levels.includes(lvl);
      const next = has ? prev.contracted_levels.filter((l) => l !== lvl) : [...prev.contracted_levels, lvl];
      const hired = next.length * SESSIONS_PER_LEVEL;
      return {
        ...prev, contracted_levels: next,
        ...(prev.sessions_auto ? { hired_sessions: hired, remaining_sessions: editing ? prev.remaining_sessions : hired } : {}),
      };
    });
  };

  const pickAccessPlan = (id: AccessPlanId) => {
    setF((prev) => ({ ...prev, access_plan: id, reschedule_policy: getAccessPlan(id)?.reschedulePolicy ?? prev.reschedule_policy }));
  };

  const changePerWeek = (val: number) => {
    const suggested = suggestDuration(prevPerWeek.current, f.session_duration, val);
    prevPerWeek.current = val;
    setF((prev) => ({ ...prev, sessions_per_week: val, session_duration: suggested }));
  };

  const editSessions = (k: "hired_sessions" | "remaining_sessions", v: number) => {
    setF((prev) => ({ ...prev, [k]: v, sessions_auto: false }));
  };

  const isCustomReschedule = f.reschedule_policy === "Custom";
  const nextPayPreview = f.payment_day
    ? nextPaymentDate(f.payment_day, f.cycle_start ? new Date(f.cycle_start) : new Date())
    : null;

  const baseValid = f.name.trim() && f.email.trim() && f.password.trim();
  const isValid = f.product_type === "performance"
    ? (baseValid && f.product && f.video_call_link.trim() && (!isEnterprise || f.company.trim()))
    : f.product_type === "workshops"
      ? baseValid // participants can be added later, but a cohort selection is recommended
      : baseValid; // insights standalone

  const pickProductType = (pt: FormState["product_type"]) => {
    setF((prev) => {
      if (pt === "performance") return { ...prev, product_type: pt };
      // Switching to a standalone branch — clear Performance-only fields so
      // downstream displays don't show stale product/plan/teacher badges.
      return {
        ...prev,
        product_type: pt,
        product: "",
        focus: "",
        company: "",
        contracted_levels: [],
        access_plan: "",
        current_level: "",
        hired_sessions: 0,
        remaining_sessions: 0,
        sessions_auto: true,
        reschedule_policy: "",
        payment_day: 1,
        cycle_start: "",
        video_call_link: "",
        teacher_id: "",
        addon_insights_per_month: pt === "insights" ? (prev.addon_insights_per_month || 1) : 0,
        addon_bookclubs_per_month: 0,
        addon_spotlight_per_month: 0,
        addon_workshops_enabled: pt === "workshops",
      };
    });
  };

  const handleSave = () => {
    if (!isValid) return;
    const accessPlan = (f.access_plan || undefined) as AccessPlanId | undefined;
    const id = initial?.id ?? `u${Date.now()}`;
    const isPerf = f.product_type === "performance";
    const u: User = {
      id,
      name: f.name.trim(),
      email: f.email.trim(),
      password: f.password,
      role: "student",
      product_type: f.product_type,
      company: isPerf && isEnterprise ? f.company.trim() || undefined : undefined,
      product: isPerf ? (f.product as ProductId) : undefined,
      focus: isPerf && !isEnterprise ? f.focus || undefined : undefined,
      access_plan: isPerf ? accessPlan : undefined,
      hired_plan: isPerf ? accessPlan : undefined, // legacy display alias
      contracted_levels: isPerf ? f.contracted_levels : [],
      current_roadmap_level: isPerf ? (initial?.current_roadmap_level ?? f.contracted_levels[0]) : undefined,
      current_level: isPerf ? (f.current_level || undefined) : undefined,
      member_since: f.member_since || undefined,
      hired_sessions: isPerf ? (Number(f.hired_sessions) || 0) : 0,
      remaining_sessions: isPerf ? (Number(f.remaining_sessions) || 0) : 0,
      sessions_auto: isPerf ? f.sessions_auto : undefined,
      sessions_per_week: isPerf ? (Number(f.sessions_per_week) || 1) : undefined,
      session_duration: isPerf ? (Number(f.session_duration) || 60) : undefined,
      reschedule_policy: isPerf ? (f.reschedule_policy || undefined) : undefined,
      reschedule_custom_hours: isPerf && isCustomReschedule ? Number(f.reschedule_custom_hours) : undefined,
      reschedule_custom_pct: isPerf && isCustomReschedule ? Number(f.reschedule_custom_pct) : undefined,
      payment_day: isPerf ? (Number(f.payment_day) || undefined) : undefined,
      cycle_start: isPerf ? (f.cycle_start || undefined) : undefined,
      video_call_link: isPerf ? f.video_call_link.trim() : undefined,
      status: initial?.status ?? "active",
      insights_strikes: initial?.insights_strikes ?? 0,
      admin_notes: initial?.admin_notes,
      next_payment: initial?.next_payment,
      addon_insights_per_month: Number(f.addon_insights_per_month) || 0,
      addon_bookclubs_per_month: isPerf ? (Number(f.addon_bookclubs_per_month) || 0) : 0,
      addon_spotlight_per_month: isPerf ? (Number(f.addon_spotlight_per_month) || 0) : 0,
      addon_workshops_enabled: f.product_type === "workshops" ? true : (isPerf && f.addon_workshops_enabled),
    };

    // Sync cohort memberships against workshops store (source of truth).
    const wantsCohorts = u.product_type === "workshops" || (u.product_type === "performance" && u.addon_workshops_enabled);
    const targetIds = new Set(wantsCohorts ? f.selected_cohort_ids : []);
    const currentIds = new Set(cohortsForStudent(id).map((x) => x.cohort.id));
    for (const cid of currentIds) if (!targetIds.has(cid)) removeParticipantFromCohort(cid, id);
    for (const cid of targetIds) if (!currentIds.has(cid)) addStudentToCohort(cid, id, u.name);

    onSave(u, isPerf ? (f.teacher_id || undefined) : undefined);
  };

  return (
    <Overlay onClose={onClose}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-card shadow-floating">
        <ModalHeader
          kicker={editing ? "Edit student" : "New registration"}
          title={editing ? f.name || "Edit Student" : "Register Student"}
          onClose={onClose}
        />

        <div className="max-h-[72vh] space-y-7 overflow-y-auto px-6 py-6 report-modal-scroll">
          {/* Basic data */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Student Name">
              <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" className={inputCls} />
            </Field>
            <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
              <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="student@company.com" className={inputCls} />
            </Field>
            <Field label="Initial Password" icon={<KeyRound className="h-3.5 w-3.5" />}>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Set a password" className={`${inputCls} pr-9`} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Toggle password">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Member Since" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <input type="date" value={f.member_since} onChange={(e) => set("member_since", e.target.value)} className={inputCls} />
            </Field>
          </div>

          {/* STEP 0 — Product Type */}
          <Step n={1} title="Product Type">
            <div className="grid grid-cols-3 gap-3">
              {PRODUCT_TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = f.product_type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => pickProductType(opt.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all ${active ? "border-accent bg-accent/10" : "border-border bg-background hover:border-accent/40"}`}
                  >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={`text-sm font-semibold ${active ? "text-accent" : "text-foreground"}`}>{opt.name}</span>
                    <span className="text-[10.5px] leading-tight text-muted-foreground">{opt.blurb}</span>
                  </button>
                );
              })}
            </div>
          </Step>

          {/* ============================================================
              BRANCH: PERFORMANCE SESSIONS — original stepped flow intact
          ============================================================ */}
          {f.product_type === "performance" && (
          <>
          <Step n={2} title="Product">
            <div className="grid grid-cols-3 gap-3">
              {PRODUCTS.map((p) => {
                const Icon = PRODUCT_ICON[p.icon];
                const active = f.product === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all ${active ? "border-accent bg-accent/10" : "border-border bg-background hover:border-accent/40"}`}
                  >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={`text-sm font-semibold ${active ? "text-accent" : "text-foreground"}`}>{p.name}</span>
                    <span className="text-[10.5px] leading-tight text-muted-foreground">{p.blurb}</span>
                  </button>
                );
              })}
            </div>

            {isEnterprise && (
              <div className="verbo-fade-up mt-4">
                <Field label="Company" icon={<Building2 className="h-3.5 w-3.5" />}>
                  <input value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Organization (required)" className={inputCls} />
                </Field>
              </div>
            )}
          </Step>

          {/* STEP 2 — Focus */}
          {product?.hasFocus && (
            <Step n={3} title="Focus">
              <div className="flex flex-wrap gap-2">
                {focusesForProduct(f.product).map((focus) => {
                  const active = f.focus === focus.name;
                  return (
                    <button
                      key={focus.id}
                      type="button"
                      onClick={() => pickFocus(focus.name)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all ${active ? "border-accent bg-accent/10 text-accent" : "border-border bg-background text-foreground hover:border-accent/40"}`}
                    >
                      {focus.name}
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {/* STEP 3 — Contracted levels */}
          {f.product && (
            <Step n={product?.hasFocus ? 4 : 3} title="Contracted levels (roadmap)">
              <div className="flex flex-wrap gap-2">
                {productLevels.map((lvl) => {
                  const active = f.contracted_levels.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => toggleLevel(lvl)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40"}`}
                    >
                      {active && <Check className="mr-1 inline h-3.5 w-3.5" />}{lvl}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Each level ≈ {SESSIONS_PER_LEVEL} live sessions.</p>
            </Step>
          )}

          {/* STEP 4 — Access plan */}
          {f.product && (
            <Step n={product?.hasFocus ? 5 : 4} title="Access plan">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ACCESS_PLAN_IDS.map((id) => {
                  const active = f.access_plan === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pickAccessPlan(id)}
                      className={`rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-all ${active ? "border-accent bg-accent/10 text-accent" : "border-border bg-background text-foreground hover:border-accent/40"}`}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>
              {f.access_plan && (
                <p className="mt-2 text-[11px] text-muted-foreground">{getAccessPlan(f.access_plan)?.blurb}</p>
              )}
            </Step>
          )}

          {/* Level + sessions */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Initial English Level" icon={<GraduationCap className="h-3.5 w-3.5" />}>
              <select value={f.current_level} onChange={(e) => set("current_level", e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Select a level</option>
                {LEVEL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>

            <Field
              label={<span className="flex items-center gap-1.5">Hired Sessions {f.sessions_auto ? <Wand2 className="h-3 w-3 text-accent" /> : <span className="rounded bg-warning/20 px-1 text-[9px] font-semibold text-foreground">edited manually</span>}</span>}
            >
              <input type="number" min={0} value={f.hired_sessions} onChange={(e) => editSessions("hired_sessions", Number(e.target.value))} className={inputCls} />
            </Field>

            <Field label="Remaining Sessions">
              <input type="number" min={0} value={f.remaining_sessions} onChange={(e) => editSessions("remaining_sessions", Number(e.target.value))} className={inputCls} />
            </Field>

            <div />

            {/* Cadence */}
            <Field label="Sessions per week" icon={<Repeat className="h-3.5 w-3.5" />}>
              <input type="number" min={1} value={f.sessions_per_week} onChange={(e) => changePerWeek(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Session duration (min)" icon={<Clock className="h-3.5 w-3.5" />}>
              <input type="number" min={15} step={5} value={f.session_duration} onChange={(e) => set("session_duration", Number(e.target.value))} className={inputCls} />
              <p className="mt-1 text-[10.5px] text-muted-foreground">{f.sessions_per_week * f.session_duration} min/week total.</p>
            </Field>

            {/* Reschedule policy */}
            <Field label="Reschedule policy" icon={<CalendarDays className="h-3.5 w-3.5" />} className="md:col-span-2">
              <select value={f.reschedule_policy} onChange={(e) => set("reschedule_policy", e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Select a policy</option>
                {RESCHEDULE_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="Custom">Custom…</option>
              </select>
            </Field>
            {isCustomReschedule && (
              <>
                <Field label="Minimum hours of notice">
                  <input type="number" min={0} value={f.reschedule_custom_hours} onChange={(e) => set("reschedule_custom_hours", Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Max % of monthly sessions">
                  <input type="number" min={0} max={100} value={f.reschedule_custom_pct} onChange={(e) => set("reschedule_custom_pct", Number(e.target.value))} className={inputCls} />
                </Field>
              </>
            )}

            {/* Payment */}
            <Field label="Payment day (1–31)" icon={<CreditCard className="h-3.5 w-3.5" />}>
              <input type="number" min={1} max={31} value={f.payment_day} onChange={(e) => set("payment_day", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Cycle start" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <input type="date" value={f.cycle_start} onChange={(e) => set("cycle_start", e.target.value)} className={inputCls} />
              {nextPayPreview && <p className="mt-1 text-[10.5px] text-muted-foreground">Next payment: {nextPayPreview.toLocaleDateString()}</p>}
            </Field>

            {/* Video call link */}
            <Field label="Video Call Link" icon={<Video className="h-3.5 w-3.5" />} className="md:col-span-2">
              <input type="url" value={f.video_call_link} onChange={(e) => set("video_call_link", e.target.value)} placeholder="https://teams.microsoft.com/..." className={inputCls} />
              <p className="mt-1 text-[10.5px] text-muted-foreground">This link will be used for all of the student's sessions until an admin changes it.</p>
            </Field>

            {/* Teacher */}
            <Field label="Assign Initial Teacher" icon={<Users className="h-3.5 w-3.5" />} className="md:col-span-2">
              <select value={f.teacher_id} onChange={(e) => set("teacher_id", e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Select a teacher (optional)</option>
                {teachersForProduct(teachers, f.product || null).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {f.product && <p className="mt-1 text-[10.5px] text-muted-foreground">Solo se muestran teachers calificados para {getProduct(f.product)?.name}.</p>}
            </Field>
          </div>

          {/* Add-on Access (Performance branch only) */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-accent"><Sparkles className="h-3.5 w-3.5" /></span>
              <h3 className="text-sm font-semibold text-foreground">Add-on Access</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Insights (per month)" icon={<Lightbulb className="h-3.5 w-3.5" />}>
                <input type="number" min={0} value={f.addon_insights_per_month} onChange={(e) => set("addon_insights_per_month", Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Book Clubs (per month)" icon={<Users className="h-3.5 w-3.5" />}>
                <input type="number" min={0} value={f.addon_bookclubs_per_month} onChange={(e) => set("addon_bookclubs_per_month", Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Spotlight Sessions (per month)" icon={<Sparkles className="h-3.5 w-3.5" />}>
                <input type="number" min={0} value={f.addon_spotlight_per_month} onChange={(e) => set("addon_spotlight_per_month", Number(e.target.value))} className={inputCls} />
              </Field>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Layers className="h-3.5 w-3.5" /> Workshops
              </label>
              <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1">
                <button type="button" onClick={() => set("addon_workshops_enabled", true)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${f.addon_workshops_enabled ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Yes</button>
                <button type="button" onClick={() => { set("addon_workshops_enabled", false); set("selected_cohort_ids", []); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${!f.addon_workshops_enabled ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>No</button>
              </div>
              {f.addon_workshops_enabled && (
                <div className="mt-3">
                  <CohortChipsPicker
                    selectedIds={f.selected_cohort_ids}
                    currentUserId={initial?.id}
                    onChange={(ids) => set("selected_cohort_ids", ids)}
                  />
                  <p className="mt-1 text-[10.5px] text-muted-foreground">Cohorts are created in Admin → Focus Workshops. A student can be enrolled in multiple cohorts over time.</p>
                </div>
              )}
            </div>
          </div>
          </>
          )}

          {/* ============================================================
              BRANCH: FOCUS WORKSHOPS — standalone (no Performance fields)
          ============================================================ */}
          {f.product_type === "workshops" && (
            <Step n={2} title="Workshop Cohorts">
              <p className="mb-3 text-[11px] text-muted-foreground">Standalone workshop customer. Add them to one or more cohorts from the Focus Workshops tab.</p>
              <CohortChipsPicker
                selectedIds={f.selected_cohort_ids}
                currentUserId={initial?.id}
                onChange={(ids) => set("selected_cohort_ids", ids)}
              />
            </Step>
          )}

          {/* ============================================================
              BRANCH: INSIGHTS — standalone (no Performance fields)
          ============================================================ */}
          {f.product_type === "insights" && (
            <Step n={2} title="Insights Access">
              <p className="mb-3 text-[11px] text-muted-foreground">Standalone Insights customer. Set the monthly cap for this person.</p>
              <Field label="Insights (per month)" icon={<Lightbulb className="h-3.5 w-3.5" />}>
                <input type="number" min={0} value={f.addon_insights_per_month} onChange={(e) => set("addon_insights_per_month", Number(e.target.value))} className={inputCls} />
              </Field>
            </Step>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={handleSave} disabled={!isValid}>{editing ? "Save changes" : "Save"}</PrimaryButton>
        </div>
      </div>
    </Overlay>
  );
}

// ===========================================================================
// DETAIL MODAL (tabs + actions)
// ===========================================================================
type Tab = "overview" | "performance" | "notes";

function StudentDetailModal({
  student, teachers, onClose, onUpdate, onEdit,
}: {
  student: User;
  teachers: User[];
  onClose: () => void;
  onUpdate: (u: User, teacherId?: string) => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState(student.admin_notes ?? "");
  const [showLink, setShowLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<"none" | "reassign" | "freeze">("none");
  const [teacherId, setTeacherId] = useState(ASSIGNMENTS.find((a) => a.student_id === student.id)?.teacher_id ?? "");
  const [freezeStart, setFreezeStart] = useState(student.freeze_start ?? "");
  const [freezeEnd, setFreezeEnd] = useState(student.freeze_end ?? "");

  const avatar = useAvatar(student.id);
  const product = getProduct(student.product);
  const accessPlan = getAccessPlan(student.access_plan);
  const groupInfo = groupOfStudent(student.id);
  const isGrouped = !!groupInfo;
  const strikes = student.insights_strikes ?? 0;
  const blocked = strikes >= MAX_INSIGHT_STRIKES;
  const bcStrikes = student.bookclub_strikes ?? 0;
  const bcBlocked = bcStrikes >= MAX_BOOKCLUB_STRIKES;
  const hasBookClubs = (student.addon_bookclubs_per_month ?? 0) > 0;
  const nextPay = computeNextPayment(student);

  const patch = (p: Partial<User>) => onUpdate({ ...student, ...p });

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(student.video_call_link ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  const maskedLink = (student.video_call_link ?? "").replace(/^(https?:\/\/[^/]+).*/, "$1/•••••");

  const teacherHistory = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    SESSIONS.filter((s) => s.student_id === student.id).forEach((s) => {
      const t = userById(s.teacher_id); if (!t) return;
      const prev = map.get(t.id);
      if (prev) prev.count += 1; else map.set(t.id, { name: t.name, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [student.id]);

  const saveFreeze = () => {
    if (freezeStart && freezeEnd) {
      const days = daysUntil(new Date(freezeEnd), new Date(freezeStart));
      if (days > 15) { alert("Freeze cannot exceed 15 days."); return; }
      // TODO: validate max 1 freeze per completed level once level-completion logic exists.
    }
    patch({ status: "frozen", freeze_start: freezeStart || undefined, freeze_end: freezeEnd || undefined });
    setPanel("none");
  };

  const markPaid = () => {
    // Advance to the next real occurrence of the payment day so the "next
    // payment" is always in the future and the glow disappears immediately.
    const day = student.payment_day ?? (nextPay ? nextPay.getDate() : 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const after = nextPaymentDate(day, tomorrow);
    patch({ next_payment: after.toISOString() });
  };

  return (
    <Overlay onClose={onClose}>
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-floating">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5" style={{ background: "linear-gradient(135deg, #01304a 0%, #02466b 100%)" }}>
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={student.name} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">{initials(student.name)}</div>
            )}
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">{student.name}</h2>
              <p className="text-xs text-white/70">{product?.name}{student.access_plan ? ` · ${student.access_plan}` : ""}{student.company ? ` · ${student.company}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border px-6 pt-3">
          {([["overview", "Overview"], ["performance", "Performance & Attendance"], ["notes", "Admin Notes"]] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${tab === id ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
              {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 report-modal-scroll">
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Info label="Email" value={student.email} />
                <Info label="CEFR Level" value={student.current_level ?? "—"} />
                <Info label="Product" value={product?.name ?? "—"} />
                <Info label="Focus" value={student.focus ?? "—"} />
                <Info label="Access Plan" value={student.access_plan ?? "—"} />
                <Info label="Current roadmap level" value={student.current_roadmap_level ?? "—"} />
                <Info label="Sessions" value={`${student.remaining_sessions ?? 0} remaining / ${student.hired_sessions ?? 0} total`} />
                <Info label="Cadence" value={`${student.sessions_per_week ?? "—"}×/week · ${student.session_duration ?? "—"} min`} />
                <Info label="Reschedule policy" value={student.reschedule_policy ?? accessPlan?.reschedulePolicy ?? "—"} />
                <Info label="Next payment" value={nextPay ? nextPay.toLocaleDateString() : "—"} />
              </div>

              {/* Contracted levels progress */}
              {student.contracted_levels && student.contracted_levels.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contracted levels</div>
                  <div className="flex flex-wrap gap-2">
                    {student.contracted_levels.map((lvl) => (
                      <Tag key={lvl} className={lvl === student.current_roadmap_level ? "bg-accent/15 text-accent" : "bg-secondary text-secondary-foreground"}>{lvl}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* Video call link */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Video Call Link</div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm text-foreground">{showLink ? student.video_call_link : maskedLink}</span>
                  <button onClick={() => setShowLink((v) => !v)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Toggle link">
                    {showLink ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={copyLink} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Copy link">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Teachers */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned teacher(s)</div>
                {teacherHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions on record yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teacherHistory.map((t) => <Tag key={t.name} className="bg-secondary text-secondary-foreground">{t.name} · {t.count}</Tag>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "performance" && <PerformanceTab student={student} />}

          {tab === "notes" && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Internal notes (admin only)</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={7}
                placeholder="Escalations, negotiated exceptions, context for other admins…"
                className={inputCls}
              />
              <div className="mt-3 flex justify-end">
                <PrimaryButton onClick={() => patch({ admin_notes: notes })}>Save notes</PrimaryButton>
              </div>
            </div>
          )}
        </div>

        {/* Inline action panels */}
        {panel === "reassign" && (
          <div className="border-t border-border bg-secondary/30 px-6 py-3">
            <div className="flex items-end gap-2">
              <Field label={`Reassign teacher${product ? ` (qualified for ${product.name})` : ""}`} className="flex-1">
                <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  <option value="">Unassigned</option>
                  {teachersForProduct(teachers, student.product || null).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <PrimaryButton onClick={() => { onUpdate(student, teacherId || undefined); setPanel("none"); }}>Apply</PrimaryButton>
            </div>
          </div>
        )}
        {panel === "freeze" && (
          <div className="border-t border-border bg-secondary/30 px-6 py-3">
            <div className="flex items-end gap-2">
              <Field label="Freeze start"><input type="date" value={freezeStart} onChange={(e) => setFreezeStart(e.target.value)} className={inputCls} /></Field>
              <Field label="Freeze end (max 15 days)"><input type="date" value={freezeEnd} onChange={(e) => setFreezeEnd(e.target.value)} className={inputCls} /></Field>
              <PrimaryButton onClick={saveFreeze}>Freeze</PrimaryButton>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <GhostButton onClick={onEdit} className="!py-1.5 !text-xs"><Pencil className="h-3.5 w-3.5" /> Edit profile</GhostButton>
          <GhostButton onClick={() => alert(`Recovery email sent to ${student.email}.`)} className="!py-1.5 !text-xs"><KeyRound className="h-3.5 w-3.5" /> Reset password</GhostButton>
          <GhostButton onClick={() => setPanel((p) => (p === "reassign" ? "none" : "reassign"))} className="!py-1.5 !text-xs"><Users className="h-3.5 w-3.5" /> Reassign teacher</GhostButton>
          <GhostButton onClick={() => setPanel((p) => (p === "freeze" ? "none" : "freeze"))} className="!py-1.5 !text-xs"><Snowflake className="h-3.5 w-3.5" /> Freeze</GhostButton>
          {student.status === "suspended" ? (
            <GhostButton onClick={() => patch({ status: "active" })} className="!py-1.5 !text-xs"><Play className="h-3.5 w-3.5" /> Reactivate</GhostButton>
          ) : (
            <GhostButton onClick={() => patch({ status: "suspended" })} className="!py-1.5 !text-xs"><Ban className="h-3.5 w-3.5" /> Suspend</GhostButton>
          )}
          <button
            onClick={() => blocked && patch({ insights_strikes: 0 })}
            disabled={!blocked}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all enabled:hover:brightness-110 disabled:opacity-40"
            style={{ backgroundColor: "#f38934" }}
          >
            <Unlock className="h-3.5 w-3.5" /> Unlock Insights ({strikes}/{MAX_INSIGHT_STRIKES})
          </button>
          {hasBookClubs && (
            <button
              onClick={() => bcBlocked && patch({ bookclub_strikes: 0 })}
              disabled={!bcBlocked}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all enabled:hover:brightness-110 disabled:opacity-40"
              style={{ backgroundColor: "#0f766e" }}
            >
              <Unlock className="h-3.5 w-3.5" /> Unlock Book Clubs ({bcStrikes}/{MAX_BOOKCLUB_STRIKES})
            </button>
          )}
          <button
            onClick={markPaid}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <CreditCard className="h-3.5 w-3.5" /> Mark as paid
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---- Performance tab (mock data for now) ----
function PerformanceTab({ student }: { student: User }) {
  const rows = SESSIONS.filter((s) => s.student_id === student.id);
  const completed = rows.filter((s) => s.status === "completed").length;
  const absent = rows.filter((s) => s.status === "absent").length;
  const ratings = rows.map((s) => s.student_rating).filter((r): r is number => typeof r === "number");
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
  const attendance = student.attendance_percentage ?? (completed + absent > 0 ? Math.round((completed / (completed + absent)) * 100) : 0);

  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">Mock metrics — wired to real data when Sessions & KPIs are built.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attendance" value={`${attendance}%`} />
        <Stat label="Completed" value={String(completed)} />
        <Stat label="Absences" value={String(absent)} />
        <Stat label="Avg. rating given" value={avgRating} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}

// ===========================================================================
// Shared building blocks
// ===========================================================================
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl">{children}</div>
    </div>
  );
}

function ModalHeader({ kicker, title, onClose }: { kicker: string; title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-border px-6 py-5" style={{ background: "linear-gradient(135deg, #01304a 0%, #02466b 100%)" }}>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">{kicker}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{title}</h2>
      </div>
      <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Field({
  label, icon, children, className,
}: {
  label: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </label>
      {children}
    </div>
  );
}

// ===========================================================================
// Cohort chips picker — READS the workshops store (source of truth) and
// returns the selected cohort ids to the parent form. It never persists on
// its own; the parent syncs memberships on save.
// ===========================================================================
function CohortChipsPicker({ selectedIds, currentUserId, onChange }: {
  selectedIds: string[];
  currentUserId?: string;
  onChange: (ids: string[]) => void;
}) {
  const [templates, setTemplates] = useState<WorkshopTemplate[]>(loadWorkshops);
  useEffect(() => {
    setTemplates(loadWorkshops());
    return subscribeWorkshops(() => setTemplates(loadWorkshops()));
  }, []);

  const all = useMemo(() => {
    const list: { id: string; label: string; cohort: WorkshopCohort; full: boolean }[] = [];
    for (const t of templates) {
      for (const c of t.cohorts) {
        const includesMe = !!currentUserId && c.participants.some((p) => p.id === currentUserId);
        const full = !includesMe && c.participants.length >= 4;
        list.push({ id: c.id, label: `${t.name} — ${c.name || "Untitled cohort"}`, cohort: c, full });
      }
    }
    return list;
  }, [templates, currentUserId]);

  const selectedSet = new Set(selectedIds);
  const available = all.filter((x) => !selectedSet.has(x.id));

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const item = all.find((x) => x.id === id);
            const label = item ? item.label : id;
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {label}
                <button type="button" onClick={() => onChange(selectedIds.filter((x) => x !== id))} className="ml-1 opacity-70 hover:opacity-100" aria-label="Remove cohort">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {all.length === 0 ? (
        <p className="text-xs text-muted-foreground">No cohorts yet. Create one in Admin → Focus Workshops.</p>
      ) : available.length === 0 ? (
        <p className="text-xs text-muted-foreground">This person is already enrolled in every available cohort.</p>
      ) : (
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onChange([...selectedIds, v]);
          }}
          className={`${inputCls} cursor-pointer`}
        >
          <option value="">Add cohort…</option>
          {available.map((x) => (
            <option key={x.id} value={x.id} disabled={x.full}>
              {x.label}{x.full ? " · full" : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
