import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, GhostButton, PrimaryButton, SectionTitle, Pill } from "@/components/verbo/ui";
import {
  Plus,
  Trash2,
  X,
  Sparkles,
  Pencil,
  Compass,
  Briefcase,
  Globe,
  ArrowLeft,
  ChevronRight,
  Lock,
  Wand2,
  Link2,
  Info,
} from "lucide-react";
import {
  loadActivities,
  renameUnitReferences,
} from "@/lib/activities-store";
import {
  ActivityModal,
  Field,
  ModalFooter,
  ModalShell,
  inputCls,
  textareaCls,
} from "@/components/verbo/course-modals";
import {
  type ProductId,
  type ProductCourse,
  type CourseLevel,
  type CourseUnit,
  PRODUCT_META,
  PRODUCT_ORDER,
  UNITS_PER_LEVEL,
  buildSkeletonUnits,
  loadCourses,
  persistCourses,
  subscribeCourses,
} from "@/lib/product-courses-store";

export const Route = createFileRoute("/admin/courses")({ component: Page });

const PRODUCT_ICON: Record<ProductId, React.ComponentType<{ className?: string }>> = {
  go: Compass,
  enterprise: Briefcase,
  international: Globe,
};

function Page() {
  const [courses, setCourses] = useState<ProductCourse[]>(loadCourses);
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);

  const [unitModal, setUnitModal] = useState<{ mode: "create" | "edit"; unit?: CourseUnit } | null>(null);
  const [actModalUnit, setActModalUnit] = useState<{ unitId: string; unitTitle: string } | null>(null);
  const [activityRev, setActivityRev] = useState(0);

  useEffect(() => {
    setCourses(loadCourses());
    return subscribeCourses(() => setCourses(loadCourses()));
  }, []);

  const allActivities = useMemo(() => loadActivities(), [activityRev]);

  const product = productId ? courses.find((c) => c.product === productId) ?? null : null;
  const level = product && levelId ? product.levels.find((l) => l.id === levelId) ?? null : null;

  const mutateLevel = (fn: (units: CourseUnit[]) => CourseUnit[]) => {
    if (!productId || !levelId) return;
    setCourses((prev) => {
      const next = prev.map((c) =>
        c.product === productId
          ? { ...c, levels: c.levels.map((l) => (l.id === levelId ? { ...l, units: fn(l.units) } : l)) }
          : c,
      );
      persistCourses(next);
      return next;
    });
  };

  const sortUnits = (units: CourseUnit[]) =>
    [...units].sort((a, b) => unitNum(a.id) - unitNum(b.id));

  const createUnit = (title: string, num: number, videoUrl: string, pdfUrl: string) => {
    if (!level) return;
    const id = `${level.id}-U${num}`;
    mutateLevel((units) => sortUnits([...units.filter((u) => u.id !== id), { id, title, video_url: videoUrl, pdf_url: pdfUrl }]));
  };

  const updateUnit = (originalId: string, title: string, num: number, videoUrl: string, pdfUrl: string) => {
    if (!level) return;
    const newId = `${level.id}-U${num}`;
    mutateLevel((units) =>
      sortUnits([...units.filter((u) => u.id !== originalId && u.id !== newId), { id: newId, title, video_url: videoUrl, pdf_url: pdfUrl }]),
    );
    if (newId !== originalId) {
      renameUnitReferences(originalId, newId);
      setActivityRev((r) => r + 1);
    }
  };

  const deleteUnit = (unitId: string) => {
    if (!confirm("Delete this unit and all its activities?")) return;
    mutateLevel((units) => units.filter((u) => u.id !== unitId));
  };

  const generateSkeleton = () => {
    if (!level) return;
    const existingNums = new Set(level.units.map((u) => unitNum(u.id)));
    const generated = buildSkeletonUnits(level.id).filter((u) => !existingNums.has(unitNum(u.id)));
    mutateLevel((units) => sortUnits([...units, ...generated]));
  };

  /* ---------------- Screen 1: Product selection ---------------- */
  if (!product) {
    return (
      <div className="space-y-8">
        <Header title="Courses" subtitle="Select a product to manage its levels and units." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_ORDER.map((pid) => {
            const Icon = PRODUCT_ICON[pid];
            const c = courses.find((x) => x.product === pid);
            const levelCount = c?.levels.length ?? 0;
            const unitCount = c?.levels.reduce((s, l) => s + l.units.length, 0) ?? 0;
            return (
              <button
                key={pid}
                onClick={() => { setProductId(pid); setLevelId(null); }}
                className="group flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-elevated"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#01304a] to-[#024366] text-white">
                  <Icon className="h-7 w-7" />
                </span>
                <div>
                  <div className="text-lg font-semibold tracking-tight text-foreground">{PRODUCT_META[pid].label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{PRODUCT_META[pid].description}</div>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                  <Pill tone="muted">{levelCount} levels</Pill>
                  <Pill tone={unitCount ? "success" : "muted"}>{unitCount} units</Pill>
                  <ChevronRight className="ml-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------- Screen 2: Level selection ---------------- */
  if (!level) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <GhostButton onClick={() => setProductId(null)}><ArrowLeft className="h-3.5 w-3.5" /> All products</GhostButton>
          <Header title={`${PRODUCT_META[product.product].label} — Levels`} subtitle="Choose a commercial level to manage its 30 units." />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {product.levels.map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => setLevelId(lvl.id)}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-elevated"
            >
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{lvl.id}</div>
              <div className="text-lg font-semibold tracking-tight text-foreground">{lvl.name}</div>
              <div className="mt-2 flex items-center justify-between">
                <Pill tone={lvl.units.length >= UNITS_PER_LEVEL ? "success" : "muted"}>
                  {lvl.units.length}/{UNITS_PER_LEVEL} units
                </Pill>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------- Screen 3: Units of the level ---------------- */
  const missing = UNITS_PER_LEVEL - level.units.length;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <GhostButton onClick={() => setLevelId(null)}><ArrowLeft className="h-3.5 w-3.5" /> {PRODUCT_META[product.product].label} levels</GhostButton>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button className="hover:text-foreground" onClick={() => setProductId(null)}>{PRODUCT_META[product.product].label}</button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{level.name}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{level.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{level.units.length}/{UNITS_PER_LEVEL} units created · manage units and their activities.</p>
        </div>
        <div className="flex items-center gap-2">
          {missing > 0 && (
            <PrimaryButton onClick={generateSkeleton}>
              <Wand2 className="h-3.5 w-3.5" /> Generate Level Skeleton
            </PrimaryButton>
          )}
          <GhostButton onClick={() => setUnitModal({ mode: "create" })}>
            <Plus className="h-3.5 w-3.5" /> Add unit
          </GhostButton>
        </div>
      </div>

      {missing > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          This level has {missing} of {UNITS_PER_LEVEL} units missing. Use “Generate Level Skeleton” to create 30 empty units (9 content + 1 review, repeated three times), then fill each unit in.
        </div>
      )}

      <Card className="!p-0">
        {level.units.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">No units yet for this level.</div>
        )}
        {level.units.map((u, i) => {
          const count = allActivities.filter((a) => a.unit_id === u.id).length;
          return (
            <div key={u.id} className={`flex items-center justify-between gap-4 px-6 py-4 ${i ? "border-t border-border" : ""}`}>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{u.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{u.id}</span>
                  <span>•</span>
                  <Pill tone={count ? "success" : "muted"}>{count} {count === 1 ? "activity" : "activities"}</Pill>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PrimaryButton onClick={() => setActModalUnit({ unitId: u.id, unitTitle: u.title })}>
                  <Sparkles className="h-3.5 w-3.5" /> Add Activities
                </PrimaryButton>
                <button
                  onClick={() => setUnitModal({ mode: "edit", unit: u })}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-[#f38934]"
                  aria-label="Edit unit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteUnit(u.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  aria-label="Delete unit"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </Card>

      {unitModal && (
        <UnitModal
          level={level}
          editingUnit={unitModal.mode === "edit" ? unitModal.unit : undefined}
          onClose={() => setUnitModal(null)}
          onCreate={(title, num, videoUrl, pdfUrl) => { createUnit(title, num, videoUrl, pdfUrl); setUnitModal(null); }}
          onUpdate={(id, title, num, videoUrl, pdfUrl) => { updateUnit(id, title, num, videoUrl, pdfUrl); setUnitModal(null); }}
        />
      )}
      {actModalUnit && (
        <ActivityModal
          unitId={actModalUnit.unitId}
          unitTitle={actModalUnit.unitTitle}
          onClose={() => { setActModalUnit(null); setActivityRev((r) => r + 1); }}
        />
      )}
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function unitNum(unitId: string): number {
  const m = unitId.match(/-U(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

/* ---------------- Unit Modal ---------------- */

function UnitModal({ level, editingUnit, onClose, onCreate, onUpdate }: {
  level: CourseLevel;
  editingUnit?: CourseUnit;
  onClose: () => void;
  onCreate: (title: string, unitNumber: number, videoUrl: string, pdfUrl: string) => void;
  onUpdate: (originalId: string, title: string, unitNumber: number, videoUrl: string, pdfUrl: string) => void;
}) {
  const isEdit = !!editingUnit;
  const [title, setTitle] = useState(isEdit ? editingUnit!.title : "");
  const [unitNumber, setUnitNumber] = useState(isEdit ? unitNum(editingUnit!.id) : level.units.length + 1);
  const [videoSource, setVideoSource] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState(isEdit ? editingUnit!.video_url : "");
  const [pdfUrl, setPdfUrl] = useState(isEdit ? editingUnit!.pdf_url : "");

  const handleSave = () => {
    if (isEdit) onUpdate(editingUnit!.id, title.trim(), unitNumber, videoUrl.trim(), pdfUrl.trim());
    else onCreate(title.trim(), unitNumber, videoUrl.trim(), pdfUrl.trim());
  };

  return (
    <ModalShell title={isEdit ? "Edit Unit" : "New unit"} subtitle={isEdit ? `${level.name} · update this unit. Activities remain untouched.` : `${level.name} · add a unit. You can attach activities afterwards.`} onClose={onClose}>
      <div className="space-y-4 p-6">
        <Field label="Unit Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Travel & directions" />
        </Field>
        <Field label="Unit Number">
          <input type="number" min={1} max={UNITS_PER_LEVEL} value={unitNumber} onChange={(e) => setUnitNumber(Number(e.target.value))} className={`${inputCls} max-w-[140px]`} />
        </Field>

        <Field label="Lesson Video">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVideoSource("url")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${videoSource === "url" ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
            >
              <Link2 className="h-4 w-4" /> Video URL
            </button>
            <button
              type="button"
              disabled
              title="Disponible tras la migración a Supabase"
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-muted-foreground opacity-70"
            >
              <Lock className="h-4 w-4" /> Upload Video
            </button>
          </div>
          {videoSource === "url" ? (
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={`${inputCls} mt-2`} placeholder="e.g., https://youtube.com/watch?v=... or vimeo link" />
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
              Disponible tras la migración a Supabase.
            </div>
          )}
        </Field>

        <Field label="Study Guide PDF URL" hint="Paste a public document or cloud storage link.">
          <input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} className={inputCls} placeholder="e.g., https://supabase.storage/... or public document link" />
        </Field>
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={!title.trim()} onClick={handleSave}>{isEdit ? "Save Changes" : "Create unit"}</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}

/* ---------------- Activity Modal ---------------- */

const TYPE_OPTIONS: { value: ExerciseType; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "fill_gaps", icon: AlignLeft },
  { value: "drag_drop", icon: GripVertical },
  { value: "listen_select", icon: Headphones },
  { value: "read_select", icon: BookOpen },
  { value: "record", icon: Mic },
  { value: "read_complete", icon: ListChecks },
  { value: "match", icon: Shuffle },
];

function ActivityModal({ unitId, unitTitle, onClose }: { unitId: string; unitTitle: string; onClose: () => void }) {
  const [phase, setPhase] = useState<SessionPhase>("pre");
  const [name, setName] = useState("");
  const [type, setType] = useState<ExerciseType>("fill_gaps");

  // shared draft state — only the relevant slice is rendered & saved
  const [paragraph, setParagraph] = useState("");
  const [answer, setAnswer] = useState("");
  const [items, setItems] = useState<{ text: string; key: string }[]>([{ text: "", key: "" }, { text: "", key: "" }]);
  const [prompt, setPrompt] = useState("");
  const [audioName, setAudioName] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [rev, setRev] = useState(0);

  const existing = useMemo(() => activitiesForUnit(unitId), [unitId, rev]);
  const preList = existing.filter((a) => phaseOf(a) === "pre");
  const postList = existing.filter((a) => phaseOf(a) === "post");

  const resetDraft = () => {
    setName(""); setParagraph(""); setAnswer("");
    setItems([{ text: "", key: "" }, { text: "", key: "" }]);
    setPrompt(""); setAudioName(""); setQuestion("");
    setOptions(["", "", "", ""]); setCorrectIndex(0);
  };

  const save = () => {
    if (!name.trim()) { alert("Please give the activity a name."); return; }
    const base: Activity = { id: `act-${Date.now()}`, unit_id: unitId, name: name.trim(), type, session_phase: phase };
    let payload: Activity = base;
    if (type === "fill_gaps" || type === "read_complete") {
      if (!paragraph.trim() || !answer.trim()) { alert("Provide a paragraph and the correct answer."); return; }
      payload = { ...base, paragraph: paragraph.trim(), answer: answer.trim() };
    } else if (type === "drag_drop" || type === "match") {
      const cleaned = items.filter((i) => i.text.trim() && i.key.trim());
      if (cleaned.length < 2) { alert("Add at least two text/destination pairs."); return; }
      payload = { ...base, items: cleaned };
    } else if (type === "read_select" || type === "listen_select") {
      if (!question.trim() || options.filter((o) => o.trim()).length < 2) { alert("Add a question and at least two options."); return; }
      payload = { ...base, prompt: prompt.trim(), audioName: type === "listen_select" ? audioName.trim() : undefined, question: question.trim(), options: options.map((o) => o.trim()), correctIndex };
    } else if (type === "record") {
      if (!answer.trim()) { alert("Type the sentence the student must speak."); return; }
      payload = { ...base, answer: answer.trim() };
    }
    addActivity(payload);
    resetDraft();
    setRev((r) => r + 1);
  };

  return (
    <ModalShell title="Activities" subtitle={unitTitle} onClose={onClose} width="max-w-4xl">
      <div className="grid gap-0 md:grid-cols-[1fr_320px]">
        <div className="space-y-5 border-b border-border p-6 md:border-b-0 md:border-r">
          <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1">
            <button
              onClick={() => setPhase("pre")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${phase === "pre" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >Pre-Session</button>
            <button
              onClick={() => setPhase("post")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${phase === "post" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >Post-Session</button>
          </div>

          {phase === "post" && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Post-session activities unlock for the student once their live session for this unit is marked Completed. They do not count toward the 80% unit-progress requirement.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Activity Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Past tense practice" />
            </Field>
            <Field label="Exercise Type">
              <select value={type} onChange={(e) => setType(e.target.value as ExerciseType)} className={inputCls}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{EXERCISE_LABELS[t.value]}</option>)}
              </select>
            </Field>
          </div>

          {(type === "fill_gaps" || type === "read_complete") && (
            <div className="space-y-4">
              <Field label="Sentence / paragraph" hint="Use [blank] to mark each empty space.">
                <textarea value={paragraph} onChange={(e) => setParagraph(e.target.value)} className={textareaCls} placeholder="She [blank] to the office every morning." />
              </Field>
              <Field label="Correct answer">
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} className={inputCls} placeholder="goes" />
              </Field>
            </div>
          )}

          {(type === "drag_drop" || type === "match") && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Draggable items and their correct destinations</div>
              {items.map((it, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_36px]">
                  <input value={it.text} onChange={(e) => setItems((arr) => arr.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} className={inputCls} placeholder={`Item ${i + 1}`} />
                  <input value={it.key} onChange={(e) => setItems((arr) => arr.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} className={inputCls} placeholder="Correct destination" />
                  <button onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ))}
              <GhostButton onClick={() => setItems((arr) => [...arr, { text: "", key: "" }])}><Plus className="h-3.5 w-3.5" /> Add pair</GhostButton>
            </div>
          )}

          {(type === "read_select" || type === "listen_select") && (
            <div className="space-y-4">
              {type === "listen_select" ? (
                <Field label="Audio file (mock)">
                  <label className="flex h-24 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 text-sm text-muted-foreground transition-colors hover:bg-secondary">
                    <Headphones className="h-4 w-4" />
                    {audioName || "Click to upload audio"}
                    <input type="file" accept="audio/*" className="sr-only" onChange={(e) => setAudioName(e.target.files?.[0]?.name ?? "")} />
                  </label>
                </Field>
              ) : (
                <Field label="Prompt text">
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className={textareaCls} placeholder="Short passage students read first." />
                </Field>
              )}
              <Field label="Question">
                <input value={question} onChange={(e) => setQuestion(e.target.value)} className={inputCls} placeholder="What did the speaker mean?" />
              </Field>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Options · select the correct answer</div>
                {options.map((opt, i) => (
                  <label key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                    <input type="radio" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} className="h-4 w-4 accent-[#f38934]" />
                    <span className="w-6 text-xs font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                    <input value={opt} onChange={(e) => setOptions((arr) => arr.map((x, j) => j === i ? e.target.value : x))} className="flex-1 bg-transparent text-sm text-foreground outline-none" placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {type === "record" && (
            <Field label="Sentence to speak">
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className={textareaCls} placeholder="The students must say this sentence aloud." />
            </Field>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <GhostButton onClick={onClose}>Done</GhostButton>
            <PrimaryButton onClick={save}><Plus className="h-3.5 w-3.5" /> Save {phase === "post" ? "Post-Session" : "Pre-Session"} Activity</PrimaryButton>
          </div>
        </div>

        <aside className="bg-secondary/30 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activities in this unit</div>

          <PhaseGroup label="Pre-Session" tone="success" list={preList} onRemove={(id) => { removeActivity(id); setRev((r) => r + 1); }} />
          <PhaseGroup label="Post-Session" tone="warning" list={postList} onRemove={(id) => { removeActivity(id); setRev((r) => r + 1); }} showTag />
        </aside>
      </div>
    </ModalShell>
  );
}

function PhaseGroup({ label, tone, list, onRemove, showTag }: {
  label: string;
  tone: "success" | "warning";
  list: Activity[];
  onRemove: (id: string) => void;
  showTag?: boolean;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label} · {list.length}</div>
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">None yet.</div>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li key={a.id} className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-foreground">{a.name}</span>
                  {showTag && <Pill tone="warning">Post-Session</Pill>}
                </div>
                <div className="text-[11px] text-muted-foreground">{EXERCISE_LABELS[a.type]}</div>
              </div>
              <button onClick={() => onRemove(a.id)} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Modal primitives ---------------- */

function ModalShell({ title, subtitle, onClose, children, width = "max-w-xl" }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${width} overflow-hidden rounded-2xl border border-border bg-card shadow-elevated`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#01304a] to-[#024366] p-6 text-white">
          <div>
            <div className="text-base font-semibold tracking-tight">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-white/70">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-foreground">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </label>
  );
}
