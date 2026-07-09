// Shared modal + activity primitives used by both Admin > Performance Sessions
// (Courses) and Admin > Focus Workshops. Extracted from admin.courses.tsx so
// the unit-content modal isn't rebuilt in every section.

import { useMemo, useState } from "react";
import {
  Plus, Trash2, X, Info, Headphones, GripVertical, Mic, AlignLeft,
  Shuffle, BookOpen, ListChecks,
} from "lucide-react";
import { GhostButton, PrimaryButton, Pill } from "./ui";
import {
  type Activity,
  type ExerciseType,
  type SessionPhase,
  type ActivityCategory,
  EXERCISE_LABELS,
  DEFAULT_CATEGORIES,
  MANDATORY_CATEGORIES,
  categoryLabel,
  isMandatoryCategory,
  activitiesForUnit,
  addActivity,
  removeActivity,
  phaseOf,
} from "@/lib/activities-store";

export const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
export const textareaCls =
  "min-h-[96px] w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function ModalShell({ title, subtitle, onClose, children, width = "max-w-xl" }: {
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

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-foreground">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </label>
  );
}

const TYPE_OPTIONS: { value: ExerciseType; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "fill_gaps", icon: AlignLeft },
  { value: "drag_drop", icon: GripVertical },
  { value: "listen_select", icon: Headphones },
  { value: "read_select", icon: BookOpen },
  { value: "record", icon: Mic },
  { value: "read_complete", icon: ListChecks },
  { value: "match", icon: Shuffle },
];

export function ActivityModal({ unitId, unitTitle, onClose }: { unitId: string; unitTitle: string; onClose: () => void }) {
  const [phase, setPhase] = useState<SessionPhase>("pre");
  const [name, setName] = useState("");
  const [type, setType] = useState<ExerciseType>("fill_gaps");
  const [category, setCategory] = useState<ActivityCategory>("vocabulary");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
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

  const presentCategories = useMemo(() => new Set(existing.map((a) => a.category).filter(Boolean) as string[]), [existing]);
  const missingMandatory = MANDATORY_CATEGORIES.filter((c) => !presentCategories.has(c));

  const resetDraft = () => {
    setName(""); setParagraph(""); setAnswer("");
    setItems([{ text: "", key: "" }, { text: "", key: "" }]);
    setPrompt(""); setAudioName(""); setQuestion("");
    setOptions(["", "", "", ""]); setCorrectIndex(0);
  };

  const save = () => {
    if (!name.trim()) { alert("Please give the activity a name."); return; }
    const finalCategory = (useCustomCategory ? customCategory.trim().toLowerCase() : category) || "vocabulary";
    const base: Activity = { id: `act-${Date.now()}`, unit_id: unitId, name: name.trim(), type, category: finalCategory, session_phase: phase };
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
            <button onClick={() => setPhase("pre")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${phase === "pre" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Pre-Session</button>
            <button onClick={() => setPhase("post")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${phase === "post" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Post-Session</button>
          </div>

          {phase === "post" && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Post-session activities unlock for the student once their live session for this unit is marked Completed.
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

          <Field
            label="Category"
            hint="Vocabulary, Grammar, and Practice are the three mandatory categories that gate unit progression."
          >
            {!useCustomCategory ? (
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") { setUseCustomCategory(true); return; }
                    setCategory(e.target.value);
                  }}
                  className={inputCls}
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}{isMandatoryCategory(c) ? " (mandatory)" : ""}
                    </option>
                  ))}
                  <option value="__custom__">Add custom category…</option>
                </select>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Idioms"
                  className={inputCls}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setUseCustomCategory(false); setCustomCategory(""); }}
                  className="rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
              </div>
            )}
          </Field>

          {missingMandatory.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This unit is missing mandatory {missingMandatory.map(categoryLabel).join(" · ")} activities. Students cannot pass the unit until each mandatory category has at least one activity with a score ≥ 60.
            </div>
          )}

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
          <PhaseGroup label="Pre-Session" list={preList} onRemove={(id) => { removeActivity(id); setRev((r) => r + 1); }} />
          <PhaseGroup label="Post-Session" list={postList} onRemove={(id) => { removeActivity(id); setRev((r) => r + 1); }} showTag />
        </aside>
      </div>
    </ModalShell>
  );
}

function PhaseGroup({ label, list, onRemove, showTag }: {
  label: string;
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