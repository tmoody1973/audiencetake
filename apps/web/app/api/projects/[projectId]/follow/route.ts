import { run } from "@/lib/social/route";
export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return run(request, async (uid, store) => store.follow(projectId, uid, true)); }
export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return run(request, async (uid, store) => store.follow(projectId, uid, false)); }
