import { run, body } from "@/lib/social/route";
import { z } from "zod";
import { SocialError } from "@/lib/social/store";
const voteBodySchema = z.object({ pathwayId: z.string().trim().min(1).max(200) }).strict();
export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return run(request, async (uid, store) => { const parsed = voteBodySchema.safeParse(await body(request)); if (!parsed.success) throw new SocialError("invalid_vote", "A pathway is required."); return store.vote(projectId, uid, parsed.data.pathwayId, true); }); }
export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return run(request, async (uid, store) => store.vote(projectId, uid, undefined, false)); }
