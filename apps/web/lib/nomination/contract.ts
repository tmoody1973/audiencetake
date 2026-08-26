import { z } from "zod";

const publicHttpUrl = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Use a public HTTP(S) URL.");

export const nominationInputSchema = z
  .object({
    submittedUrl: publicHttpUrl,
    whyItShouldGrow: z.string().trim().min(20).max(1_200),
    submissionType: z.enum(["fan", "creator"]),
    suggestedFormat: z.string().trim().max(240).optional(),
    audienceFit: z.string().trim().max(500).optional(),
    supportingUrls: z.array(publicHttpUrl).max(5).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const unique = new Set(value.supportingUrls);
    if (unique.size !== value.supportingUrls.length) {
      context.addIssue({
        code: "custom",
        path: ["supportingUrls"],
        message: "Supporting links must be unique.",
      });
    }
  });

export type NominationInput = z.infer<typeof nominationInputSchema>;

