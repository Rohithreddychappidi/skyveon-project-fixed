import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { enqueueCourseAssignedEmail } from "../../lib/notifications";

export async function listAssignments(courseId?: string) {
  return prisma.assignment.findMany({
    where: { isDeleted: false, courseId },
    include: {
      course: true,
      employee: { select: { id: true, name: true, email: true } },
      department: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assignCourse(input: {
  courseId: string;
  targetType: "INDIVIDUAL" | "DEPARTMENT";
  employeeId?: string;
  departmentId?: string;
  assignedById: string;
}) {
  const course = await prisma.course.findFirst({ where: { id: input.courseId, isDeleted: false } });
  if (!course) throw ApiError.notFound("Course not found");

  if (input.targetType === "INDIVIDUAL") {
    if (!input.employeeId) throw ApiError.badRequest("employeeId is required for individual assignments");
    const employee = await prisma.user.findFirst({ where: { id: input.employeeId, isDeleted: false, role: "EMPLOYEE" } });
    if (!employee) throw ApiError.notFound("Employee not found");

    // Undo a prior soft-unassign instead of erroring on the unique constraint
    const existing = await prisma.assignment.findFirst({
      where: { courseId: input.courseId, employeeId: input.employeeId },
    });
    let assignment;
    if (existing) {
      if (!existing.isDeleted) throw ApiError.conflict("Already assigned to this employee");
      assignment = await prisma.assignment.update({
        where: { id: existing.id },
        data: { isDeleted: false, assignedById: input.assignedById },
      });
    } else {
      assignment = await prisma.assignment.create({
        data: {
          courseId: input.courseId,
          targetType: "INDIVIDUAL",
          employeeId: input.employeeId,
          assignedById: input.assignedById,
        },
      });
    }

    await enqueueCourseAssignedEmail(employee, course).catch(() => {});
    return assignment;
  }

  if (!input.departmentId) throw ApiError.badRequest("departmentId is required for department assignments");
  const department = await prisma.department.findFirst({ where: { id: input.departmentId, isDeleted: false } });
  if (!department) throw ApiError.notFound("Department not found");

  const existing = await prisma.assignment.findFirst({
    where: { courseId: input.courseId, departmentId: input.departmentId },
  });
  let assignment;
  if (existing) {
    if (!existing.isDeleted) throw ApiError.conflict("Already assigned to this department");
    assignment = await prisma.assignment.update({
      where: { id: existing.id },
      data: { isDeleted: false, assignedById: input.assignedById },
    });
  } else {
    assignment = await prisma.assignment.create({
      data: {
        courseId: input.courseId,
        targetType: "DEPARTMENT",
        departmentId: input.departmentId,
        assignedById: input.assignedById,
      },
    });
  }

  const members = await prisma.user.findMany({
    where: { departmentId: input.departmentId, role: "EMPLOYEE", isDeleted: false, status: "ACTIVE" },
  });
  await Promise.all(members.map((m) => enqueueCourseAssignedEmail(m, course).catch(() => {})));

  return assignment;
}

export async function unassign(id: string) {
  const assignment = await prisma.assignment.findFirst({ where: { id, isDeleted: false } });
  if (!assignment) throw ApiError.notFound("Assignment not found");
  return prisma.assignment.update({ where: { id }, data: { isDeleted: true } });
}
