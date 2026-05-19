// Mock database — replace with Lovable Cloud later.
export type Role = "student" | "teacher" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  current_level?: string;
  attendance_percentage?: number;
  avatar?: string;
}

export type SessionStatus = "scheduled" | "completed" | "absent" | "delayed";

export interface Session {
  id: string;
  student_id: string;
  teacher_id: string;
  date_time: string; // ISO
  duration_minutes: number;
  teams_link: string;
  status: SessionStatus;
  report_pdf_url?: string;
  student_rating?: number;
  notes?: string;
}

export interface Unit {
  id: string;
  title: string;
  video_url: string;
  pdf_url: string;
}

export interface Level {
  id: string; // A1, A2…
  title: string;
  units: Unit[];
}

export type MaterialType = "book" | "pdf" | "verb-list" | "video" | "image";
export interface Material {
  id: string;
  title: string;
  material_type: MaterialType;
  upload_url: string;
  category: string;
}

export const USERS: User[] = [
  { id: "u1", name: "Admin Verbo", email: "admin@verbo.com", password: "admin123", role: "admin" },
  { id: "u2", name: "Sarah Mitchell", email: "sarah@verbo.com", password: "teacher123", role: "teacher" },
  { id: "u3", name: "James Carter", email: "james@verbo.com", password: "teacher123", role: "teacher" },
  { id: "u4", name: "Elena Ruiz", email: "elena@student.com", password: "student123", role: "student", current_level: "B1", attendance_percentage: 92 },
  { id: "u5", name: "Marco Silva", email: "marco@student.com", password: "student123", role: "student", current_level: "A2", attendance_percentage: 78 },
  { id: "u6", name: "Yuki Tanaka", email: "yuki@student.com", password: "student123", role: "student", current_level: "B2", attendance_percentage: 88 },
];

// Assignments: teacher -> students
export const ASSIGNMENTS: { teacher_id: string; student_id: string }[] = [
  { teacher_id: "u2", student_id: "u4" },
  { teacher_id: "u2", student_id: "u5" },
  { teacher_id: "u3", student_id: "u6" },
];

const now = new Date();
const inMinutes = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

export const SESSIONS: Session[] = [
  // Upcoming — the live one starts soon for demoing the rating popup
  { id: "s1", student_id: "u4", teacher_id: "u2", date_time: inMinutes(-50), duration_minutes: 60, teams_link: "https://teams.microsoft.com/l/meetup", status: "scheduled" },
  { id: "s2", student_id: "u4", teacher_id: "u2", date_time: inMinutes(60 * 24), duration_minutes: 60, teams_link: "https://teams.microsoft.com/l/meetup", status: "scheduled" },
  { id: "s3", student_id: "u5", teacher_id: "u2", date_time: inMinutes(60 * 6), duration_minutes: 60, teams_link: "https://teams.microsoft.com/l/meetup", status: "scheduled" },
  { id: "s4", student_id: "u6", teacher_id: "u3", date_time: inMinutes(60 * 3), duration_minutes: 60, teams_link: "https://teams.microsoft.com/l/meetup", status: "scheduled" },
  // History
  { id: "s5", student_id: "u4", teacher_id: "u2", date_time: daysAgo(2), duration_minutes: 60, teams_link: "", status: "completed", report_pdf_url: "/mock-report.pdf", student_rating: 5 },
  { id: "s6", student_id: "u4", teacher_id: "u2", date_time: daysAgo(5), duration_minutes: 60, teams_link: "", status: "completed", report_pdf_url: "/mock-report.pdf", student_rating: 4 },
  { id: "s7", student_id: "u4", teacher_id: "u2", date_time: daysAgo(9), duration_minutes: 60, teams_link: "", status: "absent" },
  { id: "s8", student_id: "u5", teacher_id: "u2", date_time: daysAgo(3), duration_minutes: 60, teams_link: "", status: "completed", report_pdf_url: "/mock-report.pdf", student_rating: 4 },
];

export const LEVELS: Level[] = [
  { id: "A1", title: "A1 — Beginner", units: [
    { id: "A1-U1", title: "Introductions & greetings", video_url: "", pdf_url: "" },
    { id: "A1-U2", title: "Daily routines", video_url: "", pdf_url: "" },
  ]},
  { id: "A2", title: "A2 — Elementary", units: [
    { id: "A2-U1", title: "Past simple narratives", video_url: "", pdf_url: "" },
    { id: "A2-U2", title: "Travel & directions", video_url: "", pdf_url: "" },
  ]},
  { id: "B1", title: "B1 — Intermediate", units: [
    { id: "B1-U1", title: "Workplace communication", video_url: "", pdf_url: "" },
    { id: "B1-U2", title: "Expressing opinions", video_url: "", pdf_url: "" },
    { id: "B1-U3", title: "Conditional structures", video_url: "", pdf_url: "" },
  ]},
  { id: "B2", title: "B2 — Upper-Intermediate", units: [
    { id: "B2-U1", title: "Business negotiations", video_url: "", pdf_url: "" },
  ]},
];

export const MATERIALS: Material[] = [
  { id: "m1", title: "Cambridge English in Use — B1", material_type: "book", upload_url: "#", category: "Grammar" },
  { id: "m2", title: "Irregular verbs cheat sheet", material_type: "verb-list", upload_url: "#", category: "Vocabulary" },
  { id: "m3", title: "Business idioms PDF", material_type: "pdf", upload_url: "#", category: "Business" },
  { id: "m4", title: "Pronunciation masterclass", material_type: "video", upload_url: "#", category: "Speaking" },
];

export const QUOTES = [
  "The limits of my language mean the limits of my world. — Ludwig Wittgenstein",
  "One language sets you in a corridor for life. Two languages open every door along the way. — Frank Smith",
  "To have another language is to possess a second soul. — Charlemagne",
];

export function userById(id: string) {
  return USERS.find((u) => u.id === id);
}

export function studentsOfTeacher(teacherId: string) {
  const ids = ASSIGNMENTS.filter((a) => a.teacher_id === teacherId).map((a) => a.student_id);
  return USERS.filter((u) => ids.includes(u.id));
}
