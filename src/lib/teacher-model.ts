// ============================================================================
// Teacher commercial/operational model — single source of truth for the
// Admin > Teachers UI. Mirrors the shape of student-model.ts.
// ============================================================================
import { USERS, ASSIGNMENTS, SESSIONS, userById, type User, type Session } from "./mock-data";
import { PRODUCTS, type ProductId } from "./student-model";

export const DEFAULT_HOURLY_RATE = 120; // MXN / hour
export const AVAILABILITY_CHANGE_DAYS = 30; // teacher may request a change once per N days

export type TeacherStatus = "active" | "frozen" | "removed";
export type QualifiedProduct = ProductId; // enterprise | go | international | vip

export const QUALIFIED_PRODUCTS: { id: QualifiedProduct; name: string }[] = PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
}));

export function teacherStatus(t: User): TeacherStatus {
  return (t.teacher_status as TeacherStatus) ?? "active";
}

export function qualifiedProducts(t: User): QualifiedProduct[] {
  return (t.qualified_products as QualifiedProduct[]) ?? [];
}

// ----------------------------------------------------------------------------
// Assignment helpers
// ----------------------------------------------------------------------------
export function assignedStudents(teacherId: string): User[] {
  const ids = ASSIGNMENTS.filter((a) => a.teacher_id === teacherId).map((a) => a.student_id);
  return USERS.filter((u) => u.role === "student" && ids.includes(u.id));
}

export function activeStudents(teacherId: string): User[] {
  return assignedStudents(teacherId).filter((s) => (s.status ?? "active") !== "suspended");
}

// Teachers eligible to teach a given product (qualified + not removed).
export function teachersForProduct(
  teachers: User[],
  product?: string | null,
  { includeRemoved = false }: { includeRemoved?: boolean } = {},
): User[] {
  return teachers.filter((t) => {
    if (!includeRemoved && teacherStatus(t) === "removed") return false;
    if (!product) return true;
    return qualifiedProducts(t).includes(product as QualifiedProduct);
  });
}

// ----------------------------------------------------------------------------
// KPI helpers
// ----------------------------------------------------------------------------
export function ratedSessions(teacherId: string): Session[] {
  return SESSIONS.filter((s) => s.teacher_id === teacherId && typeof s.student_rating === "number");
}

export function avgRating(t: User): number | null {
  const rated = ratedSessions(t.id);
  if (rated.length) {
    const sum = rated.reduce((a, s) => a + (s.student_rating ?? 0), 0);
    return Math.round((sum / rated.length) * 10) / 10;
  }
  return typeof t.rating === "number" ? t.rating : null;
}

export function flaggedReviews(teacherId: string): Session[] {
  return SESSIONS.filter(
    (s) => s.teacher_id === teacherId && typeof s.student_rating === "number" && (s.student_rating as number) <= 2,
  ).sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time));
}

export function pendingReviews(teacherId: string): Session[] {
  return flaggedReviews(teacherId).filter((s) => (s.review_status ?? "pending") !== "reviewed");
}

export function studentName(id: string): string {
  return userById(id)?.name ?? "—";
}
