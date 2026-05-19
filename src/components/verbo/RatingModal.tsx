import { useState } from "react";
import { Star } from "lucide-react";
import type { Session } from "@/lib/mock-data";
import { userById } from "@/lib/mock-data";

export function RatingModal({ session, onSubmit }: { session: Session; onSubmit: (rating: number, note: string) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const teacher = userById(session.teacher_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-floating">
        <div className="text-xs font-medium uppercase tracking-wider text-accent">Live session feedback</div>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Rate your class with {teacher?.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your session ends shortly — please share quick feedback before logging off.</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  n <= (hover || rating)
                    ? "fill-warning text-warning"
                    : "text-border"
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything specific you'd like us to know? (optional)"
          rows={3}
          className="mt-6 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <button
          disabled={!rating}
          onClick={() => onSubmit(rating, note)}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit feedback
        </button>
      </div>
    </div>
  );
}
