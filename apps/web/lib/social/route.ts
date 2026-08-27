import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { SocialError, createSocialStore } from "./store";

export const takeSchema = z.object({ whyItShouldGrow: z.string().trim().min(1), preferredPathwayId: z.string().trim().min(1), audienceNote: z.string().trim().optional() }).strict().superRefine((v, c) => { if (v.whyItShouldGrow.length + (v.audienceNote?.length ?? 0) > 600) c.addIssue({ code: "custom", message: "Take text must be 600 characters or fewer." }); });
export const validTakeBody = (value: unknown) => takeSchema.safeParse(value).success;
export async function body(request: Request) { try { return JSON.parse(await request.text()) as unknown; } catch { throw new SocialError("invalid_json", "Send valid JSON.", 400); } }
export async function run(request: Request, action: (uid: string, store: ReturnType<typeof createSocialStore>) => Promise<unknown>) { try { const { user } = await verifyAuthenticatedRequest(request); return ok(await action(user.uid, createSocialStore(getAdminFirestore()))); } catch (e) { if (e instanceof AuthenticationError) return fail({ code: e.code, message: e.message }, 401); if (e instanceof SocialError) return fail({ code: e.code, message: e.message }, e.status); return fail({ code: "social_failed", message: "We could not save that action." }, 500); } }
