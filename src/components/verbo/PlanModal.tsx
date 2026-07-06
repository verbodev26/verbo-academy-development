import { useEffect, useState } from "react";
import { X, Lock } from "lucide-react";
import { userById } from "@/lib/mock-data";
import type { Level } from "@/lib/mock-data";
import { GhostButton } from "@/components/verbo/ui";
import type { LessonPlan, LessonSessionType } from "@/lib/lesson-plans-store";
import type { ExtSession } from "@/lib/sessions-store";

const SESSION_TYPES: LessonSessionType[] = [
  "Syllabus content",
  "Additional Content",
  "Review Session",
  "Casual Topic",
  "Evaluation",
];

export function PlanModal({
  session, existing, levels, onClose, onSave,
}: {
  session: ExtSession;
  existing?: LessonPlan;
  levels: Level[];
  onClose: () => void;
  onSave: (plan: LessonPlan) => void;
}) {
  const student = userById(session.student_id);
  const [title, setTitle] = useState(existing?.title ?? "");
  // Session Type is intentionally manual, with no default. Teacher autonomy
  // to depart from the fixed syllabus applies even on basic access plans.
  const [type, setType] = useState<LessonSessionType | "">(existing?.type ?? "");
  const [levelId, setLevelId] = useState(existing?.level_id ?? (student?.current_level ?? levels[0]?.id ?? ""));
  const [unitId, setUnitId] = useState(existing?.unit_id ?? "");
  const [comments, setComments] = useState(existing?.comments ?? "");

  const showLevelUnit = type === "Syllabus content" || type === "Evaluation";
  const currentLevel = levels.find((l) => l.id === levelId);

  useEffect(() => {
    // Reset unit when level changes if missing
    if (showLevelUnit && currentLevel && !currentLevel.units.find((u) => u.id === unitId)) {
      setUnitId(currentLevel.units[0]?.id ?? "");
    }
  }, [levelId, showLevelUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!title.trim()) { alert("Please enter a session title."); return; }
    if (!type) { alert("Please pick a Session Type."); return; }
    if (showLevelUnit && (!levelId || !unitId)) { alert("Please select a level and unit."); return; }
    const gap = +new Date(session.date_time) - Date.now();
    const planning_status: LessonPlan["planning_status"] = gap < 5 * 24 * 3_600_000 ? "late" : "on-time";
    onSave({
      session_id: session.id,
      title: title.trim(),
      type: type as LessonSessionType,
      level_id: showLevelUnit ? levelId : undefined,
      unit_id: showLevelUnit ? unitId : undefined,
      comments: comments.trim(),
      planning_status,
      saved_at: new Date().toISOString(),
    });
  };

  const inputCls = "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
  const readOnlyCls = "mt-1.5 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl rounded-2xl bg-card p-6 shadow-floating max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-lg font-semibold tracking-tight text-foreground text-slate-50">Lesson Plan</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Performance Sessions · {student?.access_plan ? `Access Plan ${student.access_plan}` : "Access Plan"}
          {" — "}prepare the pedagogical plan. Saved plans move the session from
          Scheduled to Ready in the calendar. Aim to save ≥5 days before the session for on-time planning.
        </p>

        {/* Read-only context */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Student</label>
            <input readOnly value={student?.name ?? ""} className={readOnlyCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Date & Time</label>
            <input readOnly value={new Date(session.date_time).toLocaleString()} className={readOnlyCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> MS Teams Link</label>
            <input readOnly value={session.teams_link || "—"} className={readOnlyCls} />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground">Session Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Workplace small talk practice"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">Session Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as LessonSessionType)} className={`${inputCls} cursor-pointer`}>
              <option value="" disabled>— Pick a type —</option>
              {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pick every time. There is no default: it is your professional autonomy to step off the syllabus when that adds more value.
            </p>
          </div>

          {showLevelUnit ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">Select Level</label>
                <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  {levels.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Select Unit</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  {currentLevel?.units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
                </select>
              </div>
            </div>
          ) : type ? (
            <p className="rounded-lg border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              Level and Unit only apply to <strong>Syllabus content</strong> or <strong>Evaluation</strong>.
              For this Session Type, only Teacher's comments are needed.
            </p>
          ) : null}

          <div>
            <label className="text-xs font-medium text-foreground">Teacher's comments and instructions</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Add goals, vocabulary focus, prep notes for the student…"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <GhostButton onClick={onClose} className="cursor-pointer">Cancel</GhostButton>
          <button
            onClick={submit}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#f38934" }}
          >
            Save Lesson Plan
          </button>
        </div>
      </div>
    </div>
  );
}
