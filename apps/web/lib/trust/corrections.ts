import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";

export const correctionInputSchema = z.object({
  section: z.enum(["source", "claim", "pathway", "creator", "media", "other"]),
  summary: z.string().trim().min(10).max(500),
  priorBasis: z.string().trim().min(10).max(1_000),
}).strict();

export type CorrectionInput = z.infer<typeof correctionInputSchema>;

export class CorrectionError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "CorrectionError";
  }
}

export async function recordProjectCorrection(
  database: Firestore,
  projectId: string,
  actorUid: string,
  input: CorrectionInput,
) {
  const projectRef = database.collection("projects").doc(projectId);
  const correctionRef = database.collection("projectCorrections").doc();
  const auditRef = database.collection("projectCorrectionAudits").doc(correctionRef.id);

  return database.runTransaction(async (transaction) => {
    const projectSnapshot = await transaction.get(projectRef);
    const project = projectSnapshot.data();
    if (!projectSnapshot.exists || project?.publicationStatus !== "published") {
      throw new CorrectionError("project_not_found", "Project was not found.", 404);
    }
    const fromCardVersionId = typeof project.latestCardVersionId === "string"
      ? project.latestCardVersionId
      : null;
    if (!fromCardVersionId) {
      throw new CorrectionError("card_not_found", "The project has no published card to correct.", 409);
    }

    const now = FieldValue.serverTimestamp();
    transaction.create(correctionRef, {
      correctionId: correctionRef.id,
      projectId,
      section: input.section,
      summary: input.summary,
      priorBasis: input.priorBasis,
      cardVersionId: fromCardVersionId,
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(auditRef, {
      correctionId: correctionRef.id,
      projectId,
      actorUid,
      action: "correction_recorded",
      cardVersionId: fromCardVersionId,
      createdAt: now,
    });
    transaction.set(projectRef, {
      correctionNotice: input.summary,
      correctionUpdatedAt: now,
      updatedAt: now,
    }, { merge: true });
    return { correctionId: correctionRef.id, projectId, cardVersionId: fromCardVersionId };
  });
}
