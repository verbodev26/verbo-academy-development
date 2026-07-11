// Club bookings — student-side seat reservations for Verbo Insights and
// Book Clubs. Keeps the X/3 monthly cap (individual, even for Group members)
// and the <24h cutoff in a single source of truth shared by the
// student.insights and student.sessions routes.
//
// Also updates `clubs-store` spots_taken so admin/teacher surfaces reflect
// reservations in real time.
import { useSyncExternalStore } from "react";
import { loadClubs, persistClubs, type Club, type ClubType } from "./clubs-store";
import { groupsByStudentId } from "./groups-store";
import { userById } from "./mock-data";
import type { AccessPlanId } from "./student-model";

/** Per-plan monthly seat defaults across the three consumable event types.
 *  Manual overrides on the student record (addon_*_per_month) always win,
 *  even when set to 0 — the admin has absolute control over individual cases.
 *  Advance/Core reset each month (non-accumulable). Elite accumulates (see
 *  `resolvedRemainingSeats`). Signature is unlimited. Core's real access
 *  is freemium — implemented separately. */
export const PLAN_DEFAULTS: Record<AccessPlanId, { insight: number; book: number; spotlight: number }> = {
  Core:      { insight: 0, book: 0, spotlight: 0 },
  Advance:   { insight: 2, book: 2, spotlight: 1 },
  Elite:     { insight: 4, book: 4, spotlight: 4 },
  Signature: { insight: Infinity, book: Infinity, spotlight: Infinity },
};

/** The three "consumable" event kinds gated by plan/add-on caps. */
export type AccessKind = "insight" | "book" | "spotlight";


export interface ClubBooking {
  id: string;
  student_id: string;
  club_id: string;
  club_type: ClubType;
  booked_at: string; // ISO
}

const KEY = "verbo:club-bookings";
const EVENT = "verbo:club-bookings-updated";

/** Cutoff window before start when reservations & cancellations close. */
export const RESERVATION_CUTOFF_HOURS = 24;

function safeRead(): ClubBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ClubBooking[]) : [];
  } catch { return []; }
}
function safeWrite(list: ClubBooking[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    cache = null;
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch { /* noop */ }
}

let cache: ClubBooking[] | null = null;
function snapshot(): ClubBooking[] {
  if (cache === null) cache = safeRead();
  return cache;
}

export function loadBookings(): ClubBooking[] {
  return snapshot();
}

export function bookingsForStudent(studentId: string): ClubBooking[] {
  return snapshot().filter((b) => b.student_id === studentId);
}

export function isBooked(studentId: string, clubId: string): boolean {
  return snapshot().some((b) => b.student_id === studentId && b.club_id === clubId);
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Bookings the student has made *this calendar month*, split by type. */
export function bookingsThisMonth(studentId: string, type: ClubType): number {
  const now = monthKey(new Date().toISOString());
  return snapshot().filter(
    (b) => b.student_id === studentId && b.club_type === type && monthKey(b.booked_at) === now,
  ).length;
}

/** Monthly cap for the student — for Group members, comes from the Group
 *  add-on (X/3 default). Individual cap stays per student. */
export function monthlyCap(studentId: string, type: ClubType): number {
  const groupMember = groupsByStudentId().get(studentId);
  if (groupMember) {
    // Group.addon_bookclubs_per_month covers both types (single knob at group level).
    // Fallback to 3 if unset — matches product default.
    return groupMember.addon_bookclubs_per_month ?? 3;
  }
  const u = userById(studentId);
  const raw = type === "book"
    ? u?.addon_bookclubs_per_month
    : u?.addon_insights_per_month;
  return raw ?? 3;
}

export function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 36e5;
}

/** Full reservability check. Returns a reason string if the seat can't be
 *  reserved right now; null if OK. */
export function reserveBlockedReason(
  studentId: string,
  club: Club,
): string | null {
  if (club.status === "cancelled") return "This session was cancelled.";
  if (club.status === "completed") return "This session has already taken place.";
  const hrs = hoursUntil(club.date);
  if (hrs < RESERVATION_CUTOFF_HOURS) return "Reservations close 24h before start.";
  if ((club.spots_taken ?? 0) >= club.spots_total) return "This session is full.";
  const used = bookingsThisMonth(studentId, club.type);
  const cap = monthlyCap(studentId, club.type);
  if (used >= cap) {
    return club.type === "book"
      ? `You've used your ${cap} Book Club seats for this month.`
      : `You've used your ${cap} Insight seats for this month.`;
  }
  return null;
}

/** Cancellation is only allowed if the club is still upcoming and outside
 *  the 24h cutoff window. */
export function cancelBlockedReason(club: Club): string | null {
  if (club.status !== "upcoming") return "This session can no longer be modified.";
  if (hoursUntil(club.date) < RESERVATION_CUTOFF_HOURS)
    return "Cancellations close 24h before start.";
  return null;
}

export function reserveSeat(studentId: string, clubId: string): { ok: true; booking: ClubBooking } | { ok: false; reason: string } {
  const clubs = loadClubs();
  const idx = clubs.findIndex((c) => c.id === clubId);
  if (idx < 0) return { ok: false, reason: "Session not found." };
  const club = clubs[idx];
  if (isBooked(studentId, clubId)) return { ok: false, reason: "You're already booked." };
  const blocked = reserveBlockedReason(studentId, club);
  if (blocked) return { ok: false, reason: blocked };
  const booking: ClubBooking = {
    id: `cb${Date.now()}`,
    student_id: studentId,
    club_id: clubId,
    club_type: club.type,
    booked_at: new Date().toISOString(),
  };
  safeWrite([booking, ...snapshot()]);
  // Bump spots_taken.
  clubs[idx] = { ...club, spots_taken: (club.spots_taken ?? 0) + 1 };
  persistClubs(clubs);
  return { ok: true, booking };
}

export function cancelSeat(studentId: string, clubId: string): { ok: true } | { ok: false; reason: string } {
  const clubs = loadClubs();
  const idx = clubs.findIndex((c) => c.id === clubId);
  if (idx < 0) return { ok: false, reason: "Session not found." };
  const club = clubs[idx];
  if (!isBooked(studentId, clubId)) return { ok: false, reason: "You don't have a seat here." };
  const blocked = cancelBlockedReason(club);
  if (blocked) return { ok: false, reason: blocked };
  safeWrite(snapshot().filter((b) => !(b.student_id === studentId && b.club_id === clubId)));
  clubs[idx] = { ...club, spots_taken: Math.max(0, (club.spots_taken ?? 0) - 1) };
  persistClubs(clubs);
  return { ok: true };
}

// ---- React bindings -------------------------------------------------------
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onEvent = () => { cache = null; cb(); };
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onEvent(); };
  window.addEventListener(EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
const SERVER: ClubBooking[] = [];
export function useBookings(): ClubBooking[] {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}
export function subscribeBookings(cb: () => void): () => void {
  return subscribe(cb);
}
