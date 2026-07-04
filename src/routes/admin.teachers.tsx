import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { USERS, ASSIGNMENTS, SESSIONS, userById, type User, type Session } from "@/lib/mock-data";
import { getProduct } from "@/lib/student-model";
import {
  QUALIFIED_PRODUCTS, DEFAULT_HOURLY_RATE, AVAILABILITY_CHANGE_DAYS,
  teacherStatus, qualifiedProducts, assignedStudents, activeStudents,
  teachersForProduct, avgRating, flaggedReviews, pendingReviews,
  PAYMENT_FREQUENCIES, paymentFrequency, defaultPaymentRecords, financialSummary,
  type QualifiedProduct, type TeacherStatus, type PaymentFrequency,
} from "@/lib/teacher-model";
import { useAvatar } from "@/lib/avatar-store";
import {
  Plus, X, Eye, EyeOff, Star, Users, Clock, KeyRound, Snowflake, Ban, Play,
  Pencil, Search, Filter, ArrowUpDown, Check, AlertTriangle, Mail, ShieldAlert,
  CheckCircle2, CalendarClock, ChevronRight, UserX, Wallet, FileDown, CircleDollarSign,
} from "lucide-react";

export const Route = createFileRoute("/admin/teachers")({ component: Page });

// ---------------------------------------------------------------------------
// Persistence (localStorage — swap for Lovable Cloud later)
// ---------------------------------------------------------------------------
const PROFILE_KEY = "verbo:teacher-profile-overrides";
const REGISTERED_KEY = "verbo:registered-teachers";
const REVIEW_KEY = "verbo:session-review-overrides";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function write(key: string, val: unknown) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(val));
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const STATUS_META: Record<TeacherStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-success/10 text-success" },
  frozen: { label: "Frozen", cls: "bg-blue-500/10 text-blue-600" },
  removed: { label: "Removed", cls: "bg-muted text-muted-foreground" },
};

// ===========================================================================
// PAGE
// ===========================================================================
function Page() {
  const [, forceTick] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<User | "new" | null>(null);

  useEffect(() => {
    const overrides = read<Record<string, Partial<User>>>(PROFILE_KEY, {});
    USERS.forEach((u) => { if (overrides[u.id]) Object.assign(u, overrides[u.id]); });
    read<User[]>(REGISTERED_KEY, []).forEach((u) => {
      if (!USERS.find((x) => x.id === u.id)) USERS.push(u);
    });
    const reviews = read<Record<string, Partial<Session>>>(REVIEW_KEY, {});
    SESSIONS.forEach((s) => { if (reviews[s.id]) Object.assign(s, reviews[s.id]); });
    forceTick((n) => n + 1);
  }, []);

  const teachers = USERS.filter((u) => u.role === "teacher");
  const detail = detailId ? teachers.find((t) => t.id === detailId) ?? null : null;

  // Filters
  const [q, setQ] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "">("");

  const filtered = useMemo(() => {
    let list = [...teachers];
    if (q.trim()) { const s = q.trim().toLowerCase(); list = list.filter((t) => t.name.toLowerCase().includes(s) || t.email.toLowerCase().includes(s)); }
    if (fProduct) list = list.filter((t) => qualifiedProducts(t).includes(fProduct as QualifiedProduct));
    if (fStatus) list = list.filter((t) => teacherStatus(t) === fStatus);
    if (sortBy === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "name-desc") list.sort((a, b) => b.name.localeCompare(a.name));
    return list;
  }, [teachers, q, fProduct, fStatus, sortBy]);

  // Mutations
  const persist = (updated: User) => {
    const idx = USERS.findIndex((u) => u.id === updated.id);
    if (idx >= 0) USERS[idx] = updated; else USERS.push(updated);
    const overrides = read<Record<string, Partial<User>>>(PROFILE_KEY, {});
    const { id, role, ...rest } = updated;
    overrides[updated.id] = rest;
    write(PROFILE_KEY, overrides);
    const reg = read<User[]>(REGISTERED_KEY, []);
    const ri = reg.findIndex((u) => u.id === updated.id);
    if (ri >= 0) { reg[ri] = updated; write(REGISTERED_KEY, reg); }
    forceTick((n) => n + 1);
  };

  const reassignStudent = (studentId: string, teacherId: string) => {
    const existing = ASSIGNMENTS.find((a) => a.student_id === studentId);
    if (teacherId) {
      if (existing) existing.teacher_id = teacherId;
      else ASSIGNMENTS.push({ teacher_id: teacherId, student_id: studentId });
    } else if (existing) {
      ASSIGNMENTS.splice(ASSIGNMENTS.indexOf(existing), 1);
    }
    forceTick((n) => n + 1);
  };

  const markReviewed = (sessionId: string, note: string) => {
    const s = SESSIONS.find((x) => x.id === sessionId);
    if (s) { s.review_status = "reviewed"; s.review_note = note; }
    const reviews = read<Record<string, Partial<Session>>>(REVIEW_KEY, {});
    reviews[sessionId] = { review_status: "reviewed", review_note: note };
    write(REVIEW_KEY, reviews);
    forceTick((n) => n + 1);
  };

  const registerTeacher = (u: User, studentIds: string[]) => {
    USERS.push(u);
    studentIds.forEach((sid) => reassignStudent(sid, u.id));
    const reg = read<User[]>(REGISTERED_KEY, []);
    reg.push(u); write(REGISTERED_KEY, reg);
    setFormFor(null);
    forceTick((n) => n + 1);
  };

  const updateTeacher = (u: User) => {
    persist(u);
    setFormFor(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Teachers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register, monitor and manage the teaching roster.</p>
        </div>
        <button
          onClick={() => setFormFor("new")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Register teacher
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by teacher name…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">Alphabetical order</option>
              <option value="name-asc">Name: A → Z</option>
              <option value="name-desc">Name: Z → A</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select value={fProduct} onChange={(e) => setFProduct(e.target.value)} className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">All products</option>
              {QUALIFIED_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Filter className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="removed">Removed</option>
            </select>
            <Filter className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          {(q || sortBy || fProduct || fStatus) && (
            <button onClick={() => { setQ(""); setSortBy(""); setFProduct(""); setFStatus(""); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">Showing {filtered.length} of {teachers.length} teachers</div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((t) => <TeacherCard key={t.id} teacher={t} onOpen={() => setDetailId(t.id)} />)}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center shadow-sm">
          <Search className="mb-3 h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground">No teachers found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters or search query.</p>
        </div>
      )}

      {detail && (
        <TeacherDetailModal
          teacher={detail}
          teachers={teachers}
          onClose={() => setDetailId(null)}
          onPersist={persist}
          onReassign={reassignStudent}
          onMarkReviewed={markReviewed}
          onEdit={() => { const t = detail; setDetailId(null); setFormFor(t); }}
        />
      )}

      {formFor && (
        <TeacherFormModal
          initial={formFor === "new" ? null : formFor}
          onClose={() => setFormFor(null)}
          onSave={formFor === "new" ? registerTeacher : (u) => updateTeacher(u)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// TEACHER CARD
// ===========================================================================
function TeacherCard({ teacher: t, onOpen }: { teacher: User; onOpen: () => void }) {
  const avatar = useAvatar(t.id);
  const status = teacherStatus(t);
  const products = qualifiedProducts(t);
  const rating = avgRating(t);
  const pending = pendingReviews(t.id).length;
  const active = activeStudents(t.id).length;
  const meta = STATUS_META[status];
  const dim = status === "removed";
  const glow = pending > 0 && status !== "removed";

  return (
    <button
      onClick={onOpen}
      className={`group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated ${glow ? "verbo-review-glow" : ""} ${dim ? "opacity-60" : ""}`}
    >
      {glow && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          <AlertTriangle className="h-3 w-3" /> Needs Review ({pending})
        </span>
      )}

      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initials(t.name)}</div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{t.name}</div>
          <div className="truncate text-xs text-muted-foreground">{t.email}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {products.map((p) => <Tag key={p} className="bg-primary/10 text-primary">{getProduct(p)?.name ?? p}</Tag>)}
        {products.length === 0 && <span className="text-xs text-muted-foreground">No products qualified</span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Chip icon={<Star className="h-3.5 w-3.5 fill-current text-amber-500" />} label={rating != null ? rating.toFixed(1) : "—"} sub="rating" />
        <Chip icon={<CheckCircle2 className="h-3.5 w-3.5 text-accent" />} label={`${t.plan_punctuality ?? 0}%`} sub="planning" />
        <Chip icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />} label={String(active)} sub="active students" />
        <Chip icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />} label={`${t.hours_month ?? 0}h`} sub="this month" />
      </div>

      <div className="mt-4">
        <Tag className={meta.cls}>{meta.label}</Tag>
      </div>
    </button>
  );
}

function Chip({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
      {icon}
      <div className="min-w-0 leading-tight">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="truncate text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${className}`}>{children}</span>;
}

// ===========================================================================
// DETAIL MODAL
// ===========================================================================
type Tab = "overview" | "kpis" | "availability" | "financial" | "notes";

function TeacherDetailModal({
  teacher: t, teachers, onClose, onPersist, onReassign, onMarkReviewed, onEdit,
}: {
  teacher: User;
  teachers: User[];
  onClose: () => void;
  onPersist: (u: User) => void;
  onReassign: (studentId: string, teacherId: string) => void;
  onMarkReviewed: (sessionId: string, note: string) => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const avatar = useAvatar(t.id);
  const status = teacherStatus(t);
  const meta = STATUS_META[status];

  // Editable fields
  const [rate, setRate] = useState(String(t.hourly_rate ?? DEFAULT_HOURLY_RATE));
  const [freq, setFreq] = useState<PaymentFrequency>(paymentFrequency(t));
  const [products, setProducts] = useState<QualifiedProduct[]>(qualifiedProducts(t));
  const [notes, setNotes] = useState(t.admin_notes ?? "");
  const [addAdjOpen, setAddAdjOpen] = useState(false);

  // Guided freeze / remove flow
  const [flow, setFlow] = useState<null | "frozen" | "removed">(null);
  const [reassignMap, setReassignMap] = useState<Record<string, string>>({});

  // Inline reassign (from student list)
  const [reassignFor, setReassignFor] = useState<string | null>(null);

  const assigned = assignedStudents(t.id);
  const actives = activeStudents(t.id);
  const flagged = flaggedReviews(t.id);
  const pending = pendingReviews(t.id).length;

  const productsDirty = JSON.stringify([...products].sort()) !== JSON.stringify([...qualifiedProducts(t)].sort());
  const otherTeachers = teachers.filter((x) => x.id !== t.id && teacherStatus(x) !== "removed");

  const startFlow = (target: "frozen" | "removed") => {
    if (actives.length > 0) {
      setReassignMap(Object.fromEntries(actives.map((s) => [s.id, ""])));
      setFlow(target);
    } else {
      onPersist({ ...t, teacher_status: target });
    }
  };

  const flowReady = flow ? actives.every((s) => reassignMap[s.id]) : false;

  const confirmFlow = () => {
    if (!flow || !flowReady) return;
    actives.forEach((s) => onReassign(s.id, reassignMap[s.id]));
    onPersist({ ...t, teacher_status: flow });
    setFlow(null);
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-floating">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5" style={{ background: "linear-gradient(135deg, #01304a 0%, #02466b 100%)" }}>
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">{initials(t.name)}</div>
            )}
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">{t.name}</h2>
              <p className="text-xs text-white/70">{t.email} · ${t.hourly_rate ?? DEFAULT_HOURLY_RATE} MXN/h</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag className={meta.cls}>{meta.label}</Tag>
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border px-6 pt-3">
          {([["overview", "Overview"], ["kpis", "KPIs & Performance"], ["availability", "Disponibilidad"], ["financial", "Financial"], ["notes", "Admin Notes"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`relative px-3 py-2 text-sm font-medium transition-colors ${tab === id ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
              {id === "kpis" && pending > 0 && <span className="ml-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{pending}</span>}
              {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 report-modal-scroll">
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Info label="Name" value={t.name} />
                <Info label="Email" value={t.email} />
              </div>

              {/* Hourly rate + payment frequency */}
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hourly rate (MXN)</div>
                  <div className="flex items-center rounded-lg border border-input bg-background">
                    <span className="pl-3 text-sm text-muted-foreground">$</span>
                    <input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="w-16 bg-transparent py-2 px-1 text-sm text-foreground focus:outline-none" />
                    <span className="pr-3 text-xs text-muted-foreground">/h</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment frequency</div>
                  <div className="relative">
                    <select value={freq} onChange={(e) => setFreq(e.target.value as PaymentFrequency)} className={`${selectCls} w-40 appearance-none pr-8`}>
                      {PAYMENT_FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                    <CalendarClock className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                {(String(t.hourly_rate ?? DEFAULT_HOURLY_RATE) !== rate || paymentFrequency(t) !== freq) && (
                  <PrimaryBtn onClick={() => {
                    const patch: User = { ...t, hourly_rate: Number(rate) || DEFAULT_HOURLY_RATE, payment_frequency: freq };
                    if (paymentFrequency(t) !== freq) patch.payment_records = defaultPaymentRecords(freq);
                    onPersist(patch);
                  }}>Save</PrimaryBtn>
                )}
              </div>

              {/* Qualified products */}
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qualified products (hard rule for assignments)</div>
                <div className="flex flex-wrap gap-2">
                  {QUALIFIED_PRODUCTS.map((p) => {
                    const on = products.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => setProducts((prev) => on ? prev.filter((x) => x !== p.id) : [...prev, p.id])} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                {productsDirty && <div className="mt-2"><PrimaryBtn onClick={() => onPersist({ ...t, qualified_products: products })} disabled={products.length === 0}>Save products</PrimaryBtn></div>}
              </div>

              {/* Assigned students */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned students ({assigned.length})</div>
                {assigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {assigned.map((s) => {
                      const prod = getProduct(s.product);
                      const eligible = teachersForProduct(otherTeachers, s.product);
                      return (
                        <div key={s.id} className="rounded-lg border border-border bg-background px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{s.name}</div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{prod && <Tag className="bg-primary/10 text-primary">{prod.name}</Tag>}{(s.status ?? "active") === "suspended" && <Tag className="bg-muted text-muted-foreground">Suspended</Tag>}</div>
                            </div>
                            <GhostBtn onClick={() => setReassignFor(reassignFor === s.id ? null : s.id)}><Users className="h-3.5 w-3.5" /> Reassign</GhostBtn>
                          </div>
                          {reassignFor === s.id && (
                            <div className="mt-2 flex items-end gap-2 border-t border-border pt-2">
                              <div className="flex-1">
                                <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">New teacher (qualified for {prod?.name ?? "product"})</label>
                                <select id={`ra-${s.id}`} defaultValue="" className={selectCls}>
                                  <option value="" disabled>Select teacher…</option>
                                  {eligible.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                                </select>
                                {eligible.length === 0 && <p className="mt-1 text-[10.5px] text-destructive">No other qualified teachers available.</p>}
                              </div>
                              <PrimaryBtn onClick={() => { const el = document.getElementById(`ra-${s.id}`) as HTMLSelectElement | null; if (el?.value) { onReassign(s.id, el.value); setReassignFor(null); } }}>Apply</PrimaryBtn>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "kpis" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <BigStat label="Avg. rating" value={avgRating(t) != null ? avgRating(t)!.toFixed(1) : "—"} />
                <BigStat label="Planning on time" value={`${t.plan_punctuality ?? 0}%`} />
                <BigStat label="Reports on time" value={`${t.report_punctuality ?? 0}%`} />
                <BigStat label="Hours this month" value={`${t.hours_month ?? 0}h`} />
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">Full breakdown and history live in the global <span className="font-medium text-foreground">KPIs</span> page.</p>

              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Flagged reviews ({flagged.length})
                </div>
                {flagged.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No 1–2 star sessions on record.</p>
                ) : (
                  <div className="space-y-2">
                    {flagged.map((s) => <FlaggedRow key={s.id} session={s} onMarkReviewed={onMarkReviewed} />)}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "availability" && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Declared availability</div>
                {(t.availability && t.availability.length > 0) ? (
                  <div className="space-y-2">
                    {t.availability.map((a) => (
                      <div key={a.day} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
                        <span className="text-sm font-medium text-foreground">{a.day}</span>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {a.slots.map((sl) => <Tag key={sl} className="bg-secondary text-secondary-foreground">{sl}</Tag>)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No availability declared yet.</p>}
              </div>

              {t.availability_request ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarClock className="h-4 w-4 text-amber-600" /> Pending change request</div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t.availability_request.note}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Requested on {new Date(t.availability_request.requested_on).toLocaleDateString()}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onPersist({ ...t, availability_request: null })} className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground transition-opacity hover:opacity-90"><Check className="h-3.5 w-3.5" /> Approve</button>
                    <GhostBtn onClick={() => onPersist({ ...t, availability_request: null })}><X className="h-3.5 w-3.5" /> Reject</GhostBtn>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">No pending change requests.</p>
              )}

              <p className="text-[11px] text-muted-foreground">ℹ El teacher solo puede solicitar cambios de disponibilidad una vez cada {AVAILABILITY_CHANGE_DAYS} días.</p>
            </div>
          )}

          {tab === "financial" && (
            <FinancialTab t={t} onPersist={onPersist} onAddAdjustment={() => setAddAdjOpen(true)} />
          )}



          {tab === "notes" && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Internal notes (admin only)</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={7} placeholder="Context for other admins, escalations, performance follow-ups…" className={inputCls} />
              <div className="mt-3 flex justify-end"><PrimaryBtn onClick={() => onPersist({ ...t, admin_notes: notes })}>Save notes</PrimaryBtn></div>
            </div>
          )}
        </div>

        {/* Guided freeze/remove flow */}
        {flow && (
          <div className="border-t border-border bg-secondary/40 px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              {flow === "frozen" ? <Snowflake className="h-4 w-4 text-blue-600" /> : <UserX className="h-4 w-4 text-destructive" />}
              Reassign {actives.length} active student{actives.length === 1 ? "" : "s"} before {flow === "frozen" ? "freezing" : "removing"}
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto report-modal-scroll">
              {actives.map((s) => {
                const prod = getProduct(s.product);
                const eligible = teachersForProduct(otherTeachers, s.product);
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{s.name}</div>
                      <div className="text-[10.5px] text-muted-foreground">{prod?.name}</div>
                    </div>
                    <select value={reassignMap[s.id] ?? ""} onChange={(e) => setReassignMap((m) => ({ ...m, [s.id]: e.target.value }))} className={`${selectCls} max-w-[45%]`}>
                      <option value="" disabled>New teacher…</option>
                      {eligible.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <GhostBtn onClick={() => setFlow(null)}>Cancel</GhostBtn>
              <PrimaryBtn onClick={confirmFlow} disabled={!flowReady}>Confirm {flow === "frozen" ? "Freeze" : "Remove access"}</PrimaryBtn>
            </div>
          </div>
        )}

        {/* Footer actions */}
        {!flow && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/30 px-6 py-4">
            <GhostBtn onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit profile</GhostBtn>
            <GhostBtn onClick={() => alert(`Recovery email sent to ${t.email}.`)}><KeyRound className="h-3.5 w-3.5" /> Reset password</GhostBtn>
            {status === "frozen" ? (
              <GhostBtn onClick={() => onPersist({ ...t, teacher_status: "active" })}><Play className="h-3.5 w-3.5" /> Reactivate</GhostBtn>
            ) : status === "active" ? (
              <GhostBtn onClick={() => startFlow("frozen")}><Snowflake className="h-3.5 w-3.5" /> Freeze</GhostBtn>
            ) : null}
            {status !== "removed" && (
              <button onClick={() => startFlow("removed")} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground shadow-sm transition-opacity hover:opacity-90">
                <Ban className="h-3.5 w-3.5" /> Remove access
              </button>
            )}
          </div>
        )}
      </div>

      {addAdjOpen && (
        <AddAdjustmentModal
          onClose={() => setAddAdjOpen(false)}
          onSave={(amount, reason) => {
            const adj = { id: `adj-${Date.now()}`, date: new Date().toISOString(), amount, reason };
            onPersist({ ...t, adjustments: [...(t.adjustments ?? []), adj] });
            setAddAdjOpen(false);
          }}
        />
      )}
    </Overlay>
  );
}

// ===========================================================================
// FINANCIAL TAB
// ===========================================================================
function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cycleLabel(base = new Date()) {
  return base.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function FinancialTab({ t, onPersist, onAddAdjustment }: { t: User; onPersist: (u: User) => void; onAddAdjustment: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const summary = financialSummary(t);
  const records = t.payment_records && t.payment_records.length > 0
    ? t.payment_records
    : defaultPaymentRecords(paymentFrequency(t));
  const adjustments = t.adjustments ?? [];

  const ensureRecords = () => {
    if (!t.payment_records || t.payment_records.length === 0) {
      onPersist({ ...t, payment_records: records });
    }
  };

  const updateRecord = (id: string, patch: Partial<{ date: string; status: "pending" | "paid" }>) => {
    const next = records.map((r) => (r.id === id ? { ...r, ...patch } : r));
    onPersist({ ...t, payment_records: next });
  };

  // Close a cycle: mark the next pending payment date as paid, reset worked
  // hours and clear manual adjustments to start a fresh cycle.
  const closeCycle = () => {
    const idx = records.findIndex((r) => r.status !== "paid");
    const nextRecords = idx >= 0
      ? records.map((r, i) => (i === idx ? { ...r, status: "paid" as const } : r))
      : records;
    onPersist({ ...t, payment_records: nextRecords, hours_cycle: 0, hours_month: 0, adjustments: [] });
  };

  const confirmGenerate = async () => {
    await generatePDF();
    closeCycle();
    setConfirmOpen(false);
  };


  const generatePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    const period = cycleLabel();

    doc.setFontSize(18);
    doc.text("Payroll Report", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(`Teacher: ${t.name}`, 14, 30);
    doc.text(`Email: ${t.email}`, 14, 36);
    doc.text(`Cycle: ${period}`, 14, 42);
    doc.text(`Payment frequency: ${paymentFrequency(t)}`, 14, 48);

    autoTable(doc, {
      startY: 56,
      head: [["Concept", "Value"]],
      body: [
        ["Hours worked (this cycle)", `${summary.hours} h`],
        ["Hourly rate", money(summary.rate)],
        ["Subtotal", money(summary.subtotal)],
      ],
      theme: "grid",
      headStyles: { fillColor: [2, 70, 107] },
    });

    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text("Adjustments", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Date", "Amount (MXN)", "Reason"]],
      body: adjustments.length
        ? adjustments.map((a) => [new Date(a.date).toLocaleDateString(), money(a.amount), a.reason])
        : [["—", "—", "No adjustments applied"]],
      theme: "grid",
      headStyles: { fillColor: [2, 70, 107] },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    doc.setFontSize(15);
    doc.text(`Total to Pay: ${money(summary.total)} MXN`, 14, y);

    doc.save(`payroll-${t.name.replace(/\s+/g, "-").toLowerCase()}-${period.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cycle summary · {cycleLabel()}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BigStat label="Hours worked (this cycle)" value={`${summary.hours} h`} />
          <BigStat label="Hourly rate" value={money(summary.rate)} />
          <BigStat label="Subtotal" value={money(summary.subtotal)} />
        </div>
      </div>

      {/* Payment dates */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Payment dates ({paymentFrequency(t)})
        </div>
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
              <input
                type="date"
                value={r.date.slice(0, 10)}
                onChange={(e) => { ensureRecords(); updateRecord(r.id, { date: e.target.value }); }}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span
                title="Status updates automatically when the PDF report is generated"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${r.status === "paid" ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-600"}`}
              >
                <span className={`h-2 w-2 rounded-full ${r.status === "paid" ? "bg-success" : "bg-amber-500"}`} />
                {r.status === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Adjustments */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" /> Manual adjustments
          </div>
          <GhostBtn onClick={onAddAdjustment}><Plus className="h-3.5 w-3.5" /> Add adjustment</GhostBtn>
        </div>
        {adjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No adjustments applied.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{new Date(a.date).toLocaleDateString()}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${a.amount < 0 ? "text-destructive" : "text-success"}`}>{money(a.amount)}</td>
                    <td className="px-3 py-2 text-foreground">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="rounded-xl border border-border bg-secondary/30 p-5 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total to pay</div>
        <div className="mt-1 text-4xl font-bold tracking-tight text-foreground">{money(summary.total)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">MXN · subtotal {money(summary.subtotal)} {summary.adjustments >= 0 ? "+" : "−"} {money(Math.abs(summary.adjustments))} adjustments</div>
      </div>

      <div className="flex justify-end">
        <PrimaryBtn onClick={() => setConfirmOpen(true)}><FileDown className="h-3.5 w-3.5" /> Generate PDF report</PrimaryBtn>
      </div>

      {confirmOpen && (
        <Overlay onClose={() => setConfirmOpen(false)}>
          <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileDown className="h-4 w-4 text-accent" /> Generate PDF report
            </div>
            <p className="text-sm text-muted-foreground">
              By generating the report the status changes to paid and the total hours are reset. Do you wish to continue?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <GhostBtn onClick={() => setConfirmOpen(false)}>Cancel</GhostBtn>
              <button
                onClick={confirmGenerate}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                Confirm
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ===========================================================================
// ADD ADJUSTMENT MODAL (stacked over teacher detail)
// ===========================================================================
function AddAdjustmentModal({ onClose, onSave }: { onClose: () => void; onSave: (amount: number, reason: string) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const num = Number(amount);
  const valid = amount.trim() !== "" && !Number.isNaN(num) && num !== 0 && reason.trim() !== "";

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-floating">
        <div className="flex items-start justify-between border-b border-border px-6 py-5" style={{ background: "linear-gradient(135deg, #01304a 0%, #02466b 100%)" }}>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Financial</div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Add adjustment</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <Field label="Amount (MXN)">
            <div className="flex items-center rounded-lg border border-input bg-background">
              <span className="pl-3 text-sm text-muted-foreground">$</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 or -200" className="w-full bg-transparent px-2 py-2 text-sm text-foreground focus:outline-none" />
            </div>
            <p className="mt-1 text-[10.5px] text-muted-foreground">Usa un número positivo para bonos, negativo para descuentos.</p>
          </Field>
          <Field label="Reason">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Motivo del ajuste…" className={inputCls} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => onSave(num, reason.trim())} disabled={!valid}>Save</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function FlaggedRow({ session: s, onMarkReviewed }: { session: Session; onMarkReviewed: (id: string, note: string) => void }) {
  const reviewed = (s.review_status ?? "pending") === "reviewed";
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const student = userById(s.student_id);

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${reviewed ? "border-border bg-background" : "border-destructive/30 bg-destructive/5"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{student?.name ?? "—"}</span>
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < (s.student_rating ?? 0) ? "fill-current text-amber-500" : "text-muted-foreground/30"}`} />
              ))}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">{new Date(s.date_time).toLocaleDateString()}</div>
        </div>
        <Tag className={reviewed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>{reviewed ? "Reviewed" : "Pending Review"}</Tag>
      </div>
      {s.student_comment && <p className="mt-2 text-sm text-foreground">“{s.student_comment}”</p>}
      {reviewed && s.review_note && (
        <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-[12px] text-muted-foreground"><span className="font-semibold text-foreground">Resolution:</span> {s.review_note}</p>
      )}
      {!reviewed && (
        open ? (
          <div className="mt-2 space-y-2 border-t border-border pt-2">
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (required)…" className={inputCls} />
            <div className="flex justify-end gap-2">
              <GhostBtn onClick={() => setOpen(false)}>Cancel</GhostBtn>
              <PrimaryBtn onClick={() => onMarkReviewed(s.id, note.trim())} disabled={!note.trim()}>Confirm reviewed</PrimaryBtn>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex justify-end"><GhostBtn onClick={() => setOpen(true)}><Check className="h-3.5 w-3.5" /> Mark as Reviewed</GhostBtn></div>
        )
      )}
    </div>
  );
}

// ===========================================================================
// REGISTER / EDIT FORM MODAL
// ===========================================================================
function TeacherFormModal({
  initial, onClose, onSave,
}: {
  initial: User | null;
  onClose: () => void;
  onSave: (u: User, studentIds: string[]) => void;
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [showPw, setShowPw] = useState(false);
  const [rate, setRate] = useState(String(initial?.hourly_rate ?? DEFAULT_HOURLY_RATE));
  const [products, setProducts] = useState<QualifiedProduct[]>(qualifiedProducts(initial ?? ({} as User)));
  const [studentIds, setStudentIds] = useState<string[]>([]);

  // Students with no teacher assigned (available for initial assignment)
  const unassigned = useMemo(
    () => USERS.filter((u) => u.role === "student" && !ASSIGNMENTS.some((a) => a.student_id === u.id)),
    [],
  );

  const valid = name.trim() && email.trim() && password.trim() && products.length > 0;

  const handleSave = () => {
    if (!valid) return;
    const u: User = {
      ...(initial ?? {}),
      id: initial?.id ?? `t${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      password,
      role: "teacher",
      hourly_rate: Number(rate) || DEFAULT_HOURLY_RATE,
      qualified_products: products,
      teacher_status: initial?.teacher_status ?? "active",
      plan_punctuality: initial?.plan_punctuality ?? 100,
      report_punctuality: initial?.report_punctuality ?? 100,
      hours_month: initial?.hours_month ?? 0,
      availability: initial?.availability ?? [],
      availability_request: initial?.availability_request ?? null,
    };
    onSave(u, editing ? [] : studentIds);
  };

  return (
    <Overlay onClose={onClose}>
      <div className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-floating">
        <div className="flex items-start justify-between border-b border-border px-6 py-5" style={{ background: "linear-gradient(135deg, #01304a 0%, #02466b 100%)" }}>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">{editing ? "Edit teacher" : "Register teacher"}</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{editing ? name || "Teacher" : "New teacher"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 report-modal-scroll">
          <Field label="Full name" icon={<Users className="h-3.5 w-3.5" />}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Jane Doe" />
          </Field>
          <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="jane@verbo.com" />
          </Field>
          <Field label="Initial password" icon={<KeyRound className="h-3.5 w-3.5" />}>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-muted-foreground">El teacher deberá cambiarla en su primer inicio de sesión.</p>
          </Field>
          <Field label="Hourly rate (MXN)">
            <div className="flex items-center rounded-lg border border-input bg-background">
              <span className="px-3 text-sm text-muted-foreground">$</span>
              <input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="w-32 bg-transparent py-2 pr-3 text-sm text-foreground focus:outline-none" />
              <span className="pr-3 text-xs text-muted-foreground">MXN/h</span>
            </div>
          </Field>
          <Field label="Qualified products (at least one)">
            <div className="flex flex-wrap gap-2">
              {QUALIFIED_PRODUCTS.map((p) => {
                const on = products.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => setProducts((prev) => on ? prev.filter((x) => x !== p.id) : [...prev, p.id])} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Field>

          {!editing && (
            <Field label="Assign initial students (optional)">
              {unassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unassigned students available.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unassigned.map((s) => {
                    const on = studentIds.includes(s.id);
                    const prod = getProduct(s.product);
                    const eligible = !s.product || products.includes(s.product as QualifiedProduct);
                    return (
                      <button
                        key={s.id} type="button" disabled={!eligible}
                        onClick={() => setStudentIds((prev) => on ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}
                        title={eligible ? "" : `Mark ${prod?.name} first to assign this student`}
                      >
                        {s.name}{prod ? ` · ${prod.name}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-[10.5px] text-muted-foreground">Only students whose product matches a qualified product can be assigned.</p>
            </Field>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} disabled={!valid}>{editing ? "Save changes" : "Save"}</PrimaryBtn>
        </div>
      </div>
    </Overlay>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 text-center">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const selectCls = `${inputCls} cursor-pointer`;

function Field({ label, icon, children, className }: { label: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{icon}{label}</label>
      {children}
    </div>
  );
}

function PrimaryBtn({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}>{children}</button>;
}

function GhostBtn({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40 ${className}`}>{children}</button>;
}
