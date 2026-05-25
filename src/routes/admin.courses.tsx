import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LEVELS, type Level } from "@/lib/mock-data";
import { Card, GhostButton, PrimaryButton, SectionTitle, Pill } from "@/components/verbo/ui";
import {
  Plus,
  Trash2,
  X,
  Sparkles,
  ListChecks,
  Mic,
  Headphones,
  GripVertical,
  AlignLeft,
  Shuffle,
  BookOpen,
} from "lucide-react";
import {
  type Activity,
  type ExerciseType,
  EXERCISE_LABELS,
  activitiesForUnit,
  addActivity,
  loadActivities,
  removeActivity,
} from "@/lib/activities-store";

export const Route = createFileRoute("/admin/courses")({ component: Page });

type LocalLevel = Level & { units: Level["units"] };

const STORAGE_LEVELS = "verbo:levels";

function loadLevels(): LocalLevel[] {
  if (typeof window === "undefined") return LEVELS;
  try {
    const raw = localStorage.getItem(STORAGE_LEVELS);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return LEVELS;
}
function persistLevels(l: LocalLevel[]) {
  try { localStorage.setItem(STORAGE_LEVELS, JSON.stringify(l)); } catch { /* noop */ }
}

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
const textareaCls =
  "min-h-[96px] w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

function Page() {
  const [levels, setLevels] = useState<LocalLevel[]>(LEVELS);
  const [unitModalLevel, setUnitModalLevel] = useState<LocalLevel | null>(null);
  const [actModalUnit, setActModalUnit] = useState<{ levelId: string; unitId: string; unitTitle: string } | null>(null);
  const [activityRev, setActivityRev] = useState(0);

  useEffect(() => { setLevels(loadLevels()); }, []);

  const allActivities = useMemo(() => loadActivities(), [activityRev]);

  const createUnit = (lvlId: string, title: string, unitNumber: number) => {
    setLevels((prev) => {
      const next = prev.map((l) =>
        l.id === lvlId
          ? { ...l, units: [...l.units, { id: `${lvlId}-U${unitNumber}`, title, video_url: "", pdf_url: "" }] }
          : l,
      );
      persistLevels(next);
      return next;
    });
  };

  const deleteUnit = (lvlId: string, unitId: string) => {
    if (!confirm("Delete this unit and all its activities?")) return;
    setLevels((prev) => {
      const next = prev.map((l) => l.id === lvlId ? { ...l, units: l.units.filter((u) => u.id !== unitId) } : l);
      persistLevels(next);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage levels, units, and interactive activities.</p>
        </div>
      </div>

      {levels.map((lvl) => (
        <section key={lvl.id}>
          <SectionTitle action={
            <PrimaryButton onClick={() => setUnitModalLevel(lvl)}>
              <Plus className="h-3.5 w-3.5" /> Add unit
            </PrimaryButton>
          }>{lvl.title}</SectionTitle>

          <Card className="!p-0">
            {lvl.units.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">No units yet for this level.</div>
            )}
            {lvl.units.map((u, i) => {
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
                    <PrimaryButton onClick={() => setActModalUnit({ levelId: lvl.id, unitId: u.id, unitTitle: u.title })}>
                      <Sparkles className="h-3.5 w-3.5" /> Add Activities
                    </PrimaryButton>
                    <button
                      onClick={() => deleteUnit(lvl.id, u.id)}
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
        </section>
      ))}

      {unitModalLevel && (
        <UnitModal
          level={unitModalLevel}
          levels={levels}
          onClose={() => setUnitModalLevel(null)}
          onCreate={(lvlId, title, num) => { createUnit(lvlId, title, num); setUnitModalLevel(null); }}
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

/* ---------------- Unit Modal ---------------- */

function UnitModal({ level, levels, onClose, onCreate }: {
  level: LocalLevel;
  levels: LocalLevel[];
  onClose: () => void;
  onCreate: (levelId: string, title: string, unitNumber: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [levelId, setLevelId] = useState(level.id);
  const selected = levels.find((l) => l.id === levelId) ?? level;
  const [unitNumber, setUnitNumber] = useState(selected.units.length + 1);

  useEffect(() => { setUnitNumber((levels.find((l) => l.id === levelId)?.units.length ?? 0) + 1); }, [levelId, levels]);

  return (
    <ModalShell title="New unit" subtitle="Add a unit to a level. You can attach activities afterwards." onClose={onClose}>
      <div className="space-y-4 p-6">
        <Field label="Unit Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Travel & directions" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Level">
            <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={inputCls}>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </Field>
          <Field label="Unit Number">
            <input type="number" min={1} value={unitNumber} onChange={(e) => setUnitNumber(Number(e.target.value))} className={inputCls} />
          </Field>
        </div>
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={!title.trim()} onClick={() => onCreate(levelId, title.trim(), unitNumber)}>Create unit</PrimaryButton>
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

  const resetDraft = () => {
    setName(""); setParagraph(""); setAnswer("");
    setItems([{ text: "", key: "" }, { text: "", key: "" }]);
    setPrompt(""); setAudioName(""); setQuestion("");
    setOptions(["", "", "", ""]); setCorrectIndex(0);
  };

  const save = () => {
    if (!name.trim()) { alert("Please give the activity a name."); return; }
    const base: Activity = { id: `act-${Date.now()}`, unit_id: unitId, name: name.trim(), type };
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
            <PrimaryButton onClick={save}><Plus className="h-3.5 w-3.5" /> Save Activity</PrimaryButton>
          </div>
        </div>

        <aside className="bg-secondary/30 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activities in this unit</div>
          {existing.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-4 text-xs text-muted-foreground">No activities yet — your first one will appear here.</div>
          ) : (
            <ul className="mt-4 space-y-2">
              {existing.map((a) => (
                <li key={a.id} className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-foreground">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{EXERCISE_LABELS[a.type]}</div>
                  </div>
                  <button onClick={() => { removeActivity(a.id); setRev((r) => r + 1); }} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </ModalShell>
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
