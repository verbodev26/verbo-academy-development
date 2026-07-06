import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ASSIGNMENTS, USERS, type User } from "@/lib/mock-data";
import {
  MAX_INSIGHT_STRIKES, MAX_BOOKCLUB_STRIKES,
  getProduct, nextPaymentDate, daysUntil,
} from "@/lib/student-model";
import { hydrateStudents, subscribeStudents } from "@/lib/students-store";
import {
  loadChallenges, subscribeChallenges, challengesFor, categoryColor,
  DIFFICULTY_META, DIFFICULTY_ORDER,
  type Challenge, type ChallengeProductId, type DifficultyId,
} from "@/lib/challenges-store";
import {
  getCoverageNote, setCoverageNote, subscribeCoverageNotes,
} from "@/lib/coverage-notes-store";
import { useAvatar } from "@/lib/avatar-store";
import { Card } from "@/components/verbo/ui";
import {
  Search, X, Filter, CreditCard, Crown, Users as UsersIcon, Building2,
  GraduationCap, Layers, Lightbulb, Video, Clock, Repeat, NotebookPen,
  BookOpenCheck, Lock,
} from "lucide-react";

export const Route = createFileRoute("/teacher/students")({ component: Page });

// Same "payment due within 3 days" derivation used by Admin > Students, so
// both surfaces reflect the exact same status.
function computeNextPayment(u: User): Date | null {
  if (u.next_payment) return new Date(u.next_payment);
  if (!u.payment_day) return null;
  return nextPaymentDate(u.payment_day, new Date());
}

type PayStatus = { tone: "success" | "warning" | "danger"; label: string };
function paymentStatus(u: User): PayStatus | null {
  const nextPay = computeNextPayment(u);
  if (!nextPay) return null;
  const d = daysUntil(nextPay);
  if (d < 0) return { tone: "danger", label: "Vencido" };
  if (d <= 3) return { tone: "warning", label: "Próximo a vencer" };
  return { tone: "success", label: "Al día" };
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

type GroupBy = "none" | "company" | "product" | "level";

function Page() {
  const { user } = useAuth();
  const [, tick] = useState(0);
  const [detail, setDetail] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  // Hydrate the shared USERS singleton with persisted student overrides so
  // this view reads the exact same profile data Admin > Students shows.
  useEffect(() => {
    hydrateStudents();
    tick((n) => n + 1);
    const unsub = subscribeStudents(() => tick((n) => n + 1));
    return unsub;
  }, []);

  if (!user) return null;

  // Only students assigned to the current teacher — never all platform users.
  const assignedIds = ASSIGNMENTS.filter((a) => a.teacher_id === user.id).map((a) => a.student_id);
  const myStudents = USERS.filter((u) => u.role === "student" && assignedIds.includes(u.id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? myStudents.filter((s) => s.name.toLowerCase().includes(q)) : myStudents;
  }, [myStudents, search]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ label: "", items: filtered }];
    const map = new Map<string, User[]>();
    for (const s of filtered) {
      let key = "—";
      if (groupBy === "company") key = s.company || "Sin empresa";
      else if (groupBy === "product") key = getProduct(s.product)?.name || "Sin producto";
      else if (groupBy === "level") key = s.current_level || "Sin nivel";
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, items]) => ({ label, items }));
  }, [filtered, groupBy]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Mis Alumnos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista de solo lectura de los {myStudents.length} alumnos asignados a ti.
        </p>
      </div>

      {/* Search + group control */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre de alumno…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="none">Sin agrupar</option>
            <option value="company">Agrupar por Empresa</option>
            <option value="product">Agrupar por Producto</option>
            <option value="level">Agrupar por Nivel</option>
          </select>
          <Filter className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center shadow-sm">
          <UsersIcon className="mb-3 h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground">Sin alumnos que coincidan.</p>
          <p className="mt-1 text-xs text-muted-foreground">Ajusta la búsqueda o el agrupamiento.</p>
        </div>
      )}

      {grouped.map((g) => (
        <section key={g.label || "all"} className="space-y-3">
          {g.label && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label} <span className="text-muted-foreground/60">· {g.items.length}</span>
            </h2>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((s) => (
              <StudentCard key={s.id} student={s} onOpen={() => setDetail(s)} />
            ))}
          </div>
        </section>
      ))}

      {detail && user && (
        <StudentDetailModal
          student={detail}
          teacherId={user.id}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// STUDENT CARD — read-only summary (mirrors Admin > Students layout).
// ============================================================================
function StudentCard({ student: s, onOpen }: { student: User; onOpen: () => void }) {
  const avatar = useAvatar(s.id);
  const product = getProduct(s.product);
  const strikes = s.insights_strikes ?? 0;
  const blocked = strikes >= MAX_INSIGHT_STRIKES;
  const bcStrikes = s.bookclub_strikes ?? 0;
  const bcBlocked = bcStrikes >= MAX_BOOKCLUB_STRIKES;
  const hasBookClubs = (s.addon_bookclubs_per_month ?? 0) > 0;
  const hired = s.hired_sessions ?? 0;
  const remaining = s.remaining_sessions ?? 0;
  const done = Math.max(0, hired - remaining);
  const pct = hired > 0 ? (done / hired) * 100 : 0;
  const pay = paymentStatus(s);
  const productType = s.product_type ?? "performance";
  const showInsightsBadge = productType === "performance" || productType === "insights";
  const isVip = s.product === "vip";

  // Standalone Workshops / Insights students (no performance sessions) get
  // the same compact treatment used in Admin > Students.
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
            <div className="truncate font-semibold text-foreground">
              {s.name}{s.company ? <span className="text-muted-foreground"> · {s.company}</span> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">{s.email}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Tag className="bg-primary/10 text-primary">{typeLabel}</Tag>
          {showInsightsBadge && (
            <Tag className={blocked ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}>
              {blocked ? <>Insights Blocked</> : <>Insights {strikes}/{MAX_INSIGHT_STRIKES}</>}
            </Tag>
          )}
        </div>
      </button>
    );
  }

  const payDue = pay?.tone === "warning" || pay?.tone === "danger";
  return (
    <button
      onClick={onOpen}
      className={`group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated ${payDue ? "verbo-pay-glow" : ""}`}
    >
      {isVip && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
          <Crown className="h-3 w-3" /> VIP
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
          <div className="truncate font-semibold text-foreground">
            {s.name}{s.company ? <span className="text-muted-foreground"> · {s.company}</span> : null}
          </div>
          {s.current_level && (
            <div className="truncate text-xs text-muted-foreground">Nivel {s.current_level}</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {product && <Tag className="bg-primary/10 text-primary">{product.name}</Tag>}
        {s.access_plan && <Tag className="bg-accent/10 text-accent">{s.access_plan}</Tag>}
        {s.focus && <Tag className="bg-secondary text-secondary-foreground">{s.focus}</Tag>}
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
        <Tag className={blocked ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}>
          {blocked ? <>Insights Blocked</> : <>Insights {strikes}/{MAX_INSIGHT_STRIKES}</>}
        </Tag>
        {hasBookClubs && (
          <Tag className={bcBlocked ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}>
            {bcBlocked ? <>Book Clubs Blocked</> : <>Book Clubs {bcStrikes}/{MAX_BOOKCLUB_STRIKES}</>}
          </Tag>
        )}
        {pay && (
          <Tag className={
            pay.tone === "success" ? "bg-success/10 text-success"
            : pay.tone === "warning" ? "bg-warning/20 text-foreground"
            : "bg-destructive/10 text-destructive"
          }>
            <CreditCard className="mr-1 h-3 w-3" /> {pay.label}
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

// ============================================================================
// DETAIL MODAL — read-only, plus the editable coverage-notes text field.
// ============================================================================
function StudentDetailModal({
  student: s, teacherId, onClose,
}: {
  student: User;
  teacherId: string;
  onClose: () => void;
}) {
  const product = getProduct(s.product);
  const isVip = s.product === "vip";
  const productType = s.product_type ?? "performance";
  const pay = paymentStatus(s);

  // Coverage notes — persisted per (titular teacher, student) pair.
  const [note, setNote] = useState<string>(() => getCoverageNote(teacherId, s.id));
  const [savedTick, setSavedTick] = useState(false);
  useEffect(() => {
    const unsub = subscribeCoverageNotes(() => setNote(getCoverageNote(teacherId, s.id)));
    return unsub;
  }, [teacherId, s.id]);

  const handleSaveNote = () => {
    setCoverageNote(teacherId, s.id, note);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1400);
  };

  // Suggested Challenges — reuse the same catalog Admin > Challenges edits.
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  useEffect(() => {
    setChallenges(loadChallenges());
    const unsub = subscribeChallenges(() => setChallenges(loadChallenges()));
    return unsub;
  }, []);

  const challengeProductId: ChallengeProductId | null =
    s.product === "enterprise" || s.product === "go" || s.product === "international" || s.product === "vip"
      ? s.product
      : null;

  const hired = s.hired_sessions ?? 0;
  const remaining = s.remaining_sessions ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-8 shadow-floating">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Alumno</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {s.name}{s.company ? <span className="text-muted-foreground"> · {s.company}</span> : null}
            </h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {product && <Tag className="bg-primary/10 text-primary">{product.name}</Tag>}
              {s.access_plan && <Tag className="bg-accent/10 text-accent">{s.access_plan}</Tag>}
              {s.focus && <Tag className="bg-secondary text-secondary-foreground">{s.focus}</Tag>}
              {s.current_level && <Tag className="bg-muted text-muted-foreground">Nivel {s.current_level}</Tag>}
              {isVip && (
                <Tag className="bg-amber-500/15 text-amber-600">
                  <Crown className="mr-1 h-3 w-3" /> VIP
                </Tag>
              )}
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* --- Sessions balance --- */}
        {productType === "performance" && (
          <section className="mt-6 rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> Balance de sesiones (ciclo actual)
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Stat label="Contratadas" value={String(hired)} />
              <Stat label="Restantes" value={String(remaining)} />
              <Stat label="Usadas" value={String(Math.max(0, hired - remaining))} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Usa este balance para decidir cuántas sesiones dedicar a Additional Content, Review Session
              o Casual Topic sin comprometer el avance del syllabus fijo.
            </p>
          </section>
        )}

        {/* --- Cadence & payment --- */}
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat icon={Repeat} label="Sesiones/semana" value={s.sessions_per_week ? String(s.sessions_per_week) : "—"} />
          <MiniStat icon={Clock} label="Duración" value={s.session_duration ? `${s.session_duration} min` : "—"} />
          <MiniStat
            icon={CreditCard}
            label="Estado de pago"
            value={pay?.label ?? "—"}
            tone={pay?.tone}
          />
        </section>

        {/* --- Video call link (read only) --- */}
        {s.video_call_link && (
          <section className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background p-4 text-sm">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Video Call Link:</span>
            <a
              href={s.video_call_link}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-primary hover:underline"
            >
              {s.video_call_link}
            </a>
          </section>
        )}

        {/* --- Suggested Challenges (READ-ONLY catalog reuse) --- */}
        {challengeProductId && (
          <section className="mt-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Challenges sugeridos ({product?.name})
            </div>
            <div className="mt-3 space-y-4">
              {DIFFICULTY_ORDER.map((diff) => {
                const list = challengesFor(challenges, challengeProductId, diff);
                if (list.length === 0) return null;
                return (
                  <div key={diff}>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {DIFFICULTY_META[diff].label}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {list.map((c) => (
                        <div key={c.id} className="rounded-lg border border-border bg-background p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">{c.title}</div>
                            {c.category && (
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryColor(c.category)}`}>
                                {c.category}
                              </span>
                            )}
                          </div>
                          {c.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {DIFFICULTY_ORDER.every((d) => challengesFor(challenges, challengeProductId, d).length === 0) && (
                <p className="text-xs text-muted-foreground">
                  Aún no hay challenges publicados para este producto.
                </p>
              )}
            </div>
          </section>
        )}

        {/* --- Coverage notes (editable) --- */}
        <section className="mt-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <NotebookPen className="h-3.5 w-3.5" /> Notas de cobertura
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Contexto para cualquier teacher que llegue a cubrir una sesión de este alumno.
          </p>
          {/* TODO: auto-clear cuando se complete la sesión reagendada asociada
              (ver motor de reagendamiento, aún no construido). Por ahora la
              nota persiste ligada a (teacher titular + alumno). */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Nivel real, temas sensibles, preferencias, en qué está trabajando ahora…"
            className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {savedTick && <span className="text-xs text-success">Guardado</span>}
            <button
              onClick={handleSaveNote}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Guardar nota
            </button>
          </div>
        </section>

        {/* --- VIP Course Builder placeholder --- */}
        {isVip && (
          <section className="mt-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpenCheck className="h-3.5 w-3.5" /> Course Builder VIP
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-dashed border-border bg-background p-4">
              <div>
                <div className="text-sm font-medium text-foreground">Bitácora dinámica VIP</div>
                <div className="text-xs text-muted-foreground">
                  Próximamente — se habilita cuando construyamos esta sección.
                </div>
              </div>
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
              >
                <Lock className="h-3.5 w-3.5" /> Próximamente
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success" ? "text-success"
    : tone === "warning" ? "text-foreground"
    : tone === "danger" ? "text-destructive"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}