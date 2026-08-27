import { z } from "zod";

export const CLAIM_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export const PROJECT_CLAIM_STATUSES = ["unclaimed", "pending", "approved", "rejected"] as const;

const publicHttpUrl = z
  .url()
  .max(2_000)
  .refine((value) => {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !hostname.endsWith(".local") &&
      !hostname.endsWith(".internal")
    );
  }, "Use a public HTTPS URL without credentials.");

export const claimRequestInputSchema = z
  .object({
    role: z.string().trim().min(2).max(80),
    projectConnectedEmail: z.email().max(320).transform((value) => value.toLowerCase()).optional(),
    publicProofUrl: publicHttpUrl.optional(),
    context: z.string().trim().max(1_000).optional(),
  })
  .strict()
  .refine((value) => value.projectConnectedEmail || value.publicProofUrl, {
    message: "Add a project-connected email or public professional link.",
    path: ["projectConnectedEmail"],
  });

export const claimReviewSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    reviewNote: z.string().trim().max(1_000).optional(),
  })
  .strict();

export const creatorUpdateInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(4_000),
    mediaIds: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  })
  .strict()
  .refine((value) => new Set(value.mediaIds).size === value.mediaIds.length, {
    message: "Each uploaded media item can be attached once.",
    path: ["mediaIds"],
  });

export const projectIdSchema = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9_-]+$/);

export type ClaimRequestInput = z.infer<typeof claimRequestInputSchema>;
export type ClaimReviewInput = z.infer<typeof claimReviewSchema>;
export type CreatorUpdateInput = z.infer<typeof creatorUpdateInputSchema>;

export function claimRequestId(projectId: string, uid: string): string {
  return `${projectId}_${uid}`;
}
