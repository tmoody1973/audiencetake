import { z } from "zod";

export const reportReasons = [
  "spam",
  "impersonation",
  "copyright_privacy",
  "harassment",
  "misleading",
  "other",
] as const;

export const reportStatuses = ["open", "reviewing", "resolved", "dismissed"] as const;

export const reportTargetTypes = [
  "project",
  "take",
  "reply",
  "evidence_suggestion",
  "creator_update",
] as const;

const documentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Use a valid content identifier.");

export const reportInputSchema = z
  .object({
    target: z
      .object({
        type: z.enum(reportTargetTypes),
        id: documentIdSchema,
      })
      .strict(),
    reason: z.enum(reportReasons),
    context: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const reportReviewSchema = z
  .object({
    status: z.enum(reportStatuses),
    moderationNote: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export type ReportInput = z.infer<typeof reportInputSchema>;
export type ReportReview = z.infer<typeof reportReviewSchema>;
export type ReportReason = (typeof reportReasons)[number];
export type ReportStatus = (typeof reportStatuses)[number];
export type ReportTarget = ReportInput["target"];
