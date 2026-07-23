import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { usersRouter, departmentsRouter } from "../modules/users/users.routes";
import { coursesRouter } from "../modules/courses/courses.routes";
import { assignmentsRouter } from "../modules/assignments/assignments.routes";
import { progressRouter } from "../modules/progress/progress.routes";
import { filesRouter } from "../modules/files/files.routes";
import { activityRouter } from "../modules/activity/activity.routes";
import { cmsRouter } from "../modules/cms/cms.routes";
import { adminsRouter } from "../modules/admins/admins.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ status: "ok" }));

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/departments", departmentsRouter);
apiRouter.use("/courses", coursesRouter);
apiRouter.use("/assignments", assignmentsRouter);
apiRouter.use("/progress", progressRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/activity", activityRouter);
apiRouter.use("/cms", cmsRouter);
apiRouter.use("/admins", adminsRouter);
