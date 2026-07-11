// Shared reservation modal for Verbo Insights and Book Clubs.
// Handles the <24h cutoff, X/month cap (individual, even for Group members)
// and both reserve + cancel actions. Same visual language as the Live
// Sessions modals (Card / PrimaryButton / GhostButton / semantic tokens).
import { useMemo, useState } from "react";
import { X, AlertTriangle, CheckCircle2, Users, CalendarClock, FileText, Video } from "lucide-react";
import { toast } from "sonner";
import type { Club } from "@/lib/clubs-store";
import { userById } from "@/lib/mock-data";
import {
  isBooked,
  bookingsThisMonth,
  monthlyCap,
  reserveBlockedReason,
  cancelBlockedReason,
  reserveSeat,
  cancelSeat,
  useBookings,
} from "@/lib/club-bookings-store";
import { GhostButton, PrimaryButton } from "@/components/verbo/ui";

function fmtLong(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ClubReservationModal({
  club,
  studentId,
  onClose,
}: {
  club: Club;
  studentId: string;
  onClose: () => void;
}) {
  // Subscribe so the modal re-renders after reserve/cancel.
  useBookings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const booked = isBooked(studentId, club.id);
  const used = bookingsThisMonth(studentId, club.type);
  const cap = monthlyCap(studentId, club.type);
  const isSignature = userById(studentId)?.access_plan === "Signature";
  const capDisplay = isSignature || !isFinite(cap) ? "∞" : String(cap);
  const teacher = club.teacher_id ? userById(club.teacher_id) : null;


  const reserveBlocked = useMemo(
    () => (booked ? null : reserveBlockedReason(studentId, club)),
    [booked, studentId, club],
  );
  const cancelBlocked = useMemo(
    () => (booked ? cancelBlockedReason(club) : null),
    [booked, club],
  );

  const isBook = club.type === "book";
  const accent = isBook ? "#d97706" : "#0ea5e9";
  const label = isBook ? "Book Club" : "Verbo Insight";

  const seatsPct = club.spots_total ? Math.min(100, Math.round(((club.spots_taken ?? 0) / club.spots_total) * 100)) : 0;

  const onReserve = async () => {
    setBusy(true);
    setError(null);
    const res = reserveSeat(studentId, club.id);
    setBusy(false);
    if (!res.ok) { setError(res.reason); return; }
    toast.success("Seat reserved. See you there!");
  };
  const onCancel = async () => {
    setBusy(true);
    setError(null);
    const res = cancelSeat(studentId, club.id);
    setBusy(false);
    if (!res.ok) { setError(res.reason); return; }
    toast("Reservation cancelled.");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-floating"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            style={{ background: accent }}
          >
            {label}
          </span>
          {booked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
              <CheckCircle2 className="h-3 w-3" /> You're in
            </span>
          )}
        </div>

        <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          {club.title}
        </h3>
        {club.description && (
          <p className="mt-1 text-sm text-muted-foreground">{club.description}</p>
        )}

        <div className="mt-4 space-y-2 text-sm">
          <Row icon={<CalendarClock className="h-4 w-4" />} label="When" value={`${fmtLong(club.date)} · ${club.duration_minutes} min`} />
          {teacher && <Row icon={<Video className="h-4 w-4" />} label="Host" value={teacher.name} />}
          {club.material && <Row icon={<FileText className="h-4 w-4" />} label="Material" value={club.material} />}
        </div>

        {/* Seat meter */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Seats
            </span>
            <span className="font-semibold text-foreground">
              {club.spots_taken ?? 0} / {club.spots_total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${seatsPct}%`, background: accent }}
            />
          </div>
        </div>

        {/* Rules */}
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
          <div>Reservations close 24h before start.</div>
          <div className="mt-0.5">
            You can book up to <strong>{capDisplay}</strong> {isBook ? "Book Clubs" : "Insights"} per month —
            used <strong>{used}/{capDisplay}</strong> this cycle.
          </div>

        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {booked ? (
            <>
              <PrimaryButton
                className="flex-1 justify-center"
                onClick={onCancel}
                disabled={busy || !!cancelBlocked}
                title={cancelBlocked ?? undefined}
              >
                {cancelBlocked ? cancelBlocked : busy ? "Cancelling…" : "Cancel reservation"}
              </PrimaryButton>
              <GhostButton className="flex-1 justify-center" onClick={onClose}>Close</GhostButton>
            </>
          ) : (
            <>
              <PrimaryButton
                className="flex-1 justify-center"
                onClick={onReserve}
                disabled={busy || !!reserveBlocked}
                title={reserveBlocked ?? undefined}
              >
                {reserveBlocked ? reserveBlocked : busy ? "Reserving…" : "Reserve seat"}
              </PrimaryButton>
              <GhostButton className="flex-1 justify-center" onClick={onClose}>Close</GhostButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
