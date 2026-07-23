export type Role = "MASTER_ADMIN" | "ADMIN" | "EMPLOYEE";
export type AdminPermission = "MANAGE_EMPLOYEES" | "MANAGE_COURSES" | "MANAGE_ASSIGNMENTS" | "VIEW_PROGRESS" | "MANAGE_CMS";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type LessonType = "VIDEO" | "PDF" | "PPT" | "DOC" | "IMAGE" | "LINK" | "ASSIGNMENT";
export type CompletionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type ConversionStatus = "NOT_REQUIRED" | "PENDING" | "DONE" | "FAILED";
export type AssignmentTargetType = "INDIVIDUAL" | "DEPARTMENT";
export type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  adminPermissions: AdminPermission[];
}

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  departmentId: string | null;
  department?: Department | null;
  hasSetPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  adminPermissions: AdminPermission[];
  hasSetPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Progress {
  id: string;
  employeeId: string;
  lessonId: string;
  status: CompletionStatus;
  watchedSeconds: number;
  lastPositionSeconds: number;
  confirmedAt: string | null;
  completedAt: string | null;
}

export interface LessonSubmission {
  id: string;
  lessonId: string;
  employeeId: string;
  responseText: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileMime?: string | null;
  status: SubmissionStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  employee?: { id: string; name: string; email: string };
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  type: LessonType;
  order: number;
  fileKey?: string | null;
  fileName?: string | null;
  fileMime?: string | null;
  linkUrl?: string | null;
  convertedKey?: string | null;
  conversionStatus: ConversionStatus;
  conversionError?: string | null;
  durationSeconds?: number | null;
  assignmentPrompt?: string | null;
  progress?: Progress | null;
  submission?: LessonSubmission | null;
  locked?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  department: string;
  lessons: Lesson[];
  createdAt: string;
  progress?: { completedLessons: number; totalLessons: number; percent: number };
}

export interface PublicCourse {
  id: string;
  title: string;
  description: string;
  department: string;
  lessonCount: number;
  lessonTypes: LessonType[];
}

export interface Assignment {
  id: string;
  courseId: string;
  targetType: AssignmentTargetType;
  employeeId: string | null;
  departmentId: string | null;
  createdAt: string;
  course?: Course;
  employee?: { id: string; name: string; email: string } | null;
  department?: Department | null;
}

export interface ProgressTableRow {
  employee: { id: string; name: string; email: string };
  completedLessons: number;
  totalLessons: number;
  percent: number;
  status: CompletionStatus;
}
