import type { Request, Response } from "express";
import { z } from "zod";
import * as progressService from "./progress.service";

export async function start(req: Request, res: Response) {
  const progress = await progressService.startLesson(req.user!.id, req.params.lessonId);
  res.json({ progress });
}

const heartbeatSchema = z.object({ positionSeconds: z.number().min(0) });
export async function heartbeat(req: Request, res: Response) {
  const { positionSeconds } = heartbeatSchema.parse(req.body);
  const progress = await progressService.videoHeartbeat(req.user!.id, req.params.lessonId, positionSeconds);
  res.json({ progress });
}

export async function confirm(req: Request, res: Response) {
  const progress = await progressService.confirmLesson(req.user!.id, req.params.lessonId);
  res.json({ progress });
}

const submitSchema = z.object({ responseText: z.string().optional() });
export async function submitAssignment(req: Request, res: Response) {
  const { responseText } = submitSchema.parse(req.body);
  const submission = await progressService.submitAssignment(req.user!.id, req.params.lessonId, {
    responseText,
    file: req.file,
  });
  res.json({ submission });
}

export async function mine(req: Request, res: Response) {
  const progress = await progressService.getMyProgress(req.user!.id, req.params.lessonId);
  res.json({ progress });
}

export async function courseTable(req: Request, res: Response) {
  const table = await progressService.getCourseProgressTable(req.params.courseId);
  res.json(table);
}
