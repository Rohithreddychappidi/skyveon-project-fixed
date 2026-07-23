import { prisma } from "./prisma";
import { emailQueue } from "./queue";
import { env } from "../config/env";
import type { Course, Lesson, User } from "@prisma/client";

function baseTemplate(bodyHtml: string) {
  return `<div style="font-family:sans-serif;color:#14152B;line-height:1.5">${bodyHtml}<p style="color:#8A8D9F;font-size:12px;margin-top:24px">Skyveon Learning Hub</p></div>`;
}

/** Sent to an employee (or every member of a department) when a course is assigned to them. */
export async function enqueueCourseAssignedEmail(employee: Pick<User, "id" | "name" | "email">, course: Course) {
  const link = `${env.APP_URL}/employee`;
  const html = baseTemplate(
    `<p>Hi ${employee.name},</p><p>A new course has been assigned to you: <strong>${course.title}</strong>.</p><p><a href="${link}">Open Skyveon Learning Hub</a> to get started.</p>`
  );
  await emailQueue.add(`course-assigned-${employee.id}-${course.id}`, {
    to: employee.email,
    subject: `New course assigned: ${course.title}`,
    html,
    text: `Hi ${employee.name}, a new course has been assigned to you: ${course.title}. Open ${link} to get started.`,
  });
}

/** Sent to the course's creator (and any master admins) when an employee submits an ASSIGNMENT lesson. */
export async function enqueueAssignmentSubmittedEmail(
  lesson: Pick<Lesson, "id" | "title" | "courseId">,
  employee: Pick<User, "id" | "name" | "email">
) {
  const course = await prisma.course.findUnique({ where: { id: lesson.courseId }, include: { createdBy: true } });
  const masterAdmins = await prisma.user.findMany({
    where: { role: "MASTER_ADMIN", isDeleted: false, status: "ACTIVE" },
  });

  const recipients = new Map<string, { name: string; email: string }>();
  if (course?.createdBy) recipients.set(course.createdBy.id, course.createdBy);
  for (const admin of masterAdmins) recipients.set(admin.id, admin);

  const link = `${env.APP_URL}/admin/courses/${lesson.courseId}`;
  for (const recipient of recipients.values()) {
    const html = baseTemplate(
      `<p>Hi ${recipient.name},</p><p><strong>${employee.name}</strong> (${employee.email}) submitted the assignment <strong>${lesson.title}</strong>${
        course ? ` in <strong>${course.title}</strong>` : ""
      }.</p><p><a href="${link}">Review it</a> in the admin portal.</p>`
    );
    await emailQueue.add(`assignment-submitted-${lesson.id}-${employee.id}`, {
      to: recipient.email,
      subject: `${employee.name} submitted an assignment`,
      html,
      text: `${employee.name} (${employee.email}) submitted the assignment "${lesson.title}". Review it at ${link}`,
    });
  }
}
