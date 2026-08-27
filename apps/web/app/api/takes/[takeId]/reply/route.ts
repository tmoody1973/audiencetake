import { z } from "zod";
import { run, body } from "@/lib/social/route";
import { SocialError } from "@/lib/social/store";
const replySchema = z.object({ body: z.string().trim().min(1).max(600) }).strict();
export async function PUT(request: Request, { params }: { params: Promise<{ takeId: string }> }) { const { takeId } = await params; return run(request, async (uid, store) => { const parsed = replySchema.safeParse(await body(request)); if (!parsed.success) throw new SocialError("invalid_reply", "Check the reply text."); return store.reply(takeId, uid, parsed.data.body, "create"); }); }
export async function PATCH(request: Request, { params }: { params: Promise<{ takeId: string }> }) { const { takeId } = await params; return run(request, async (uid, store) => { const parsed = replySchema.safeParse(await body(request)); if (!parsed.success) throw new SocialError("invalid_reply", "Check the reply text."); return store.reply(takeId, uid, parsed.data.body, "edit"); }); }
export async function DELETE(request: Request, { params }: { params: Promise<{ takeId: string }> }) { const { takeId } = await params; return run(request, async (uid, store) => store.reply(takeId, uid, "", "withdraw")); }
