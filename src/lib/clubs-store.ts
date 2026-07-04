// Club events — shared data source for Admin > Manage Clubs and the Admin
// Overview snapshot. The Manage Clubs page owns the live editing state; this
// module holds the seed catalog + type definitions + read helpers so Overview
// reads the SAME data instead of duplicating it.
import { USERS } from "./mock-data";

export type ClubType = "insight" | "book";
export type TimeStatus = "upcoming" | "live" | "completed" | "cancelled";
export type AssignmentStatus = "created" | "assigned";

export interface Club {
  id: string;
  type: ClubType;
  title: string;
  description: string;
  link: string;
  material?: string;
  cover_image?: string;
  teacher_id?: string;
  date: string; // ISO
  duration_minutes: number;
  spots_taken: number;
  spots_total: number;
  status: TimeStatus;
}

export const CLUB_SEED: Club[] = [
  { id: "c1", type: "insight", title: "Mastering Business Idioms", description: "Live workshop on professional idioms.", link: "https://teams.microsoft.com/l/meetup-1", material: "idioms-guide.pdf", teacher_id: "u2", date: "2026-05-28T17:00:00", duration_minutes: 60, spots_taken: 12, spots_total: 30, status: "upcoming" },
  { id: "c2", type: "book", title: "The Alchemist — Chapter 3", description: "Discussion circle on themes and vocabulary.", link: "https://teams.microsoft.com/l/meetup-2", material: "alchemist-ch3.pdf", date: "2026-05-25T18:30:00", duration_minutes: 60, spots_taken: 4, spots_total: 4, status: "upcoming" },
  { id: "c3", type: "insight", title: "Pronunciation Lab: TH Sounds", description: "Drills and pair practice.", link: "https://teams.microsoft.com/l/meetup-3", teacher_id: "u3", date: "2026-05-18T16:00:00", duration_minutes: 45, spots_taken: 22, spots_total: 25, status: "completed" },
  { id: "c4", type: "book", title: "Atomic Habits — Intro", description: "Kickoff session for the new club cycle.", link: "https://teams.microsoft.com/l/meetup-4", date: "2026-06-02T17:30:00", duration_minutes: 60, spots_taken: 1, spots_total: 4, status: "upcoming" },
];

export function assignmentOf(c: Club): AssignmentStatus {
  return c.teacher_id ? "assigned" : "created";
}

export function clubTeacherName(id?: string): string | null {
  if (!id) return null;
  return USERS.find((u) => u.id === id)?.name ?? null;
}

// Clubs still "Created" (no teacher assigned) and not finished/cancelled,
// ordered by the nearest date first — early-warning list for the admin.
export function upcomingCreatedClubs(clubs: Club[] = CLUB_SEED): Club[] {
  return clubs
    .filter((c) => !c.teacher_id && c.status !== "completed" && c.status !== "cancelled")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
}
