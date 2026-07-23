import {
  PlayCircle,
  FileText,
  Presentation,
  FileType2,
  Image as ImageIcon,
  Link2,
  ClipboardCheck,
} from "lucide-react";
import type { LessonType, CompletionStatus } from "@/lib/api-types";

export function LessonTypeIcon({
  type,
  className,
}: {
  type: LessonType;
  className?: string;
}) {
  const map: Record<LessonType, React.ElementType> = {
    VIDEO: PlayCircle,
    PDF: FileText,
    PPT: Presentation,
    DOC: FileType2,
    IMAGE: ImageIcon,
    LINK: Link2,
    ASSIGNMENT: ClipboardCheck,
  };
  const Icon = map[type];
  return <Icon className={className} strokeWidth={1.8} />;
}

export const statusLabel: Record<CompletionStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const statusTone: Record<CompletionStatus, "neutral" | "warm" | "success"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warm",
  COMPLETED: "success",
};

export const lessonTypeLabel: Record<LessonType, string> = {
  VIDEO: "Video",
  PDF: "PDF",
  PPT: "PowerPoint (auto-converts to PDF)",
  DOC: "Word doc (auto-converts to PDF)",
  IMAGE: "Image",
  LINK: "External link",
  ASSIGNMENT: "Assignment (gates later lessons until submitted)",
};
