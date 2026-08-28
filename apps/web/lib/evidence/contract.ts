import { z } from "zod";

import { youtubeVideoId } from "../media/youtube";

const evidenceUrl = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Use a public HTTP(S) URL.");

const identifier = z.string().trim().min(1).max(180);

export const evidenceSuggestionInputSchema = z
  .object({
    url: evidenceUrl,
    note: z.string().trim().min(1).max(1_000).optional(),
    suggestedUse: z.literal("scout_card_video").optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.suggestedUse === "scout_card_video" && youtubeVideoId(value.url) === null) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "A proposed Scout Card video must be a supported YouTube video URL.",
      });
    }
  });

export const evidenceReviewOutcomes = [
  "verified_incorporated",
  "relevant_support",
  "conflicts",
  "could_not_verify",
  "rejected",
] as const;

export const evidenceReviewOutcomeSchema = z.enum(evidenceReviewOutcomes);

export const incorporatedSourceSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    excerpt: z.string().trim().min(1).max(2_000),
    author: z.string().trim().min(1).max(240).nullable().optional(),
    publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    sourceType: z.enum([
      "submitted_video",
      "official_project",
      "creator_profile",
      "editorial_coverage",
      "interview",
      "campaign",
      "comparable",
      "external_commentary",
      "other",
    ]),
    supportsClaimIds: z.array(identifier).max(50).default([]),
    conflictsWithClaimIds: z.array(identifier).max(50).default([]),
    externalCommentary: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.supportsClaimIds).size !== value.supportsClaimIds.length) {
      context.addIssue({ code: "custom", path: ["supportsClaimIds"], message: "Claim IDs must be unique." });
    }
    if (new Set(value.conflictsWithClaimIds).size !== value.conflictsWithClaimIds.length) {
      context.addIssue({ code: "custom", path: ["conflictsWithClaimIds"], message: "Claim IDs must be unique." });
    }
    const overlap = value.supportsClaimIds.find((id) => value.conflictsWithClaimIds.includes(id));
    if (overlap) {
      context.addIssue({ code: "custom", message: "A source cannot both support and conflict with the same claim." });
    }
  });

export const evidenceReviewInputSchema = z
  .object({
    outcome: evidenceReviewOutcomeSchema,
    reason: z.string().trim().min(3).max(1_000),
    source: incorporatedSourceSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome === "verified_incorporated" && !value.source) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "Verified incorporation requires normalized source details.",
      });
    }
    if (value.outcome !== "verified_incorporated" && value.source) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "Only verified incorporation may create a source.",
      });
    }
  });

export type EvidenceSuggestionInput = z.infer<typeof evidenceSuggestionInputSchema>;
export type EvidenceReviewOutcome = z.infer<typeof evidenceReviewOutcomeSchema>;
export type EvidenceReviewInput = z.infer<typeof evidenceReviewInputSchema>;
export type IncorporatedSourceInput = z.infer<typeof incorporatedSourceSchema>;
