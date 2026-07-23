import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  const departments = await Promise.all(
    ["Cloud & DevOps", "AI & Machine Learning", "Data Engineering", "Enterprise Platforms", "Digital Product Engineering"].map(
      (name) => prisma.department.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  // --- Master admin — controls other admins and their permissions --------
  const masterPassword = "ChangeMe123!";
  const masterAdmin = await prisma.user.upsert({
    where: { email: "master@skyveon.ai" },
    update: {},
    create: {
      email: "master@skyveon.ai",
      name: "Skyveon Master Admin",
      role: "MASTER_ADMIN",
      status: "ACTIVE",
      passwordHash: await hashPassword(masterPassword),
    },
  });

  // --- Regular admin — granted every permission here for the demo; in
  // practice the master admin would hand out a subset via /admin/admins ---
  const adminPassword = "ChangeMe123!";
  const admin = await prisma.user.upsert({
    where: { email: "admin@skyveon.ai" },
    update: {},
    create: {
      email: "admin@skyveon.ai",
      name: "Skyveon Admin",
      role: "ADMIN",
      status: "ACTIVE",
      adminPermissions: ["MANAGE_EMPLOYEES", "MANAGE_COURSES", "MANAGE_ASSIGNMENTS", "VIEW_PROGRESS", "MANAGE_CMS"],
      passwordHash: await hashPassword(adminPassword),
    },
  });

  const employeePassword = "ChangeMe123!";
  const employee = await prisma.user.upsert({
    where: { email: "employee@skyveon.ai" },
    update: {},
    create: {
      email: "employee@skyveon.ai",
      name: "Demo Employee",
      role: "EMPLOYEE",
      status: "ACTIVE",
      departmentId: departments[1].id, // AI & Machine Learning
      passwordHash: await hashPassword(employeePassword),
    },
  });

  const course = await prisma.course.upsert({
    where: { id: "seed-course-onboarding" },
    update: {},
    create: {
      id: "seed-course-onboarding",
      title: "Responsible AI & ML Practices",
      description: "An introduction to how Skyveon builds and ships AI/ML features responsibly.",
      department: "AI & Machine Learning",
      createdById: admin.id,
      lessons: {
        create: [
          { title: "Welcome & platform overview", type: "VIDEO", order: 0, durationSeconds: 300 },
          { title: "Responsible AI principles (PDF)", type: "PDF", order: 1 },
          {
            title: "Reflection assignment",
            type: "ASSIGNMENT",
            order: 2,
            assignmentPrompt:
              "In a few sentences, describe one way you'll apply the responsible-AI principles from this course to your current work.",
          },
          // Locked until the assignment above is submitted — demonstrates
          // the gating rule.
          { title: "Team wiki", type: "LINK", order: 3, linkUrl: "https://example.com/wiki" },
        ],
      },
    },
  });

  await prisma.assignment.upsert({
    where: { courseId_employeeId: { courseId: course.id, employeeId: employee.id } },
    update: {},
    create: { courseId: course.id, targetType: "INDIVIDUAL", employeeId: employee.id, assignedById: admin.id },
  });

  console.log("✅ Seed complete.");
  console.log("");
  console.log("   Master admin login: master@skyveon.ai / " + masterPassword);
  console.log("   Admin login:        admin@skyveon.ai / " + adminPassword);
  console.log("   Employee login:     employee@skyveon.ai / " + employeePassword);
  console.log("   (change these immediately outside of local dev)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
