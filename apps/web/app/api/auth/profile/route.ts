import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { getAdminFirestore } from "@/lib/firebase/admin";

const profileSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores."),
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(240).default(""),
  avatarUrl: z.url().max(1000).optional(),
  publicActivity: z.boolean().default(true),
});

const storedProfileSchema = profileSchema.extend({
  visibility: z.literal("public"),
  demoLabel: z.string().max(80).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await verifyAuthenticatedRequest(request);
    const snapshot = await getAdminFirestore().collection("users").doc(user.uid).get();
    const profile = snapshot.exists ? storedProfileSchema.safeParse(snapshot.data()) : null;
    return ok({ uid: user.uid, profile: profile?.success ? profile.data : null });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return fail({ code: error.code, message: error.message }, 401);
    }
    return fail({ code: "profile_read_failed", message: "We could not load your profile." }, 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await verifyAuthenticatedRequest(request);
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(
        {
          code: "invalid_profile",
          message: "Check the highlighted profile fields.",
          fields: z.flattenError(parsed.error).fieldErrors,
        },
        400,
      );
    }

    const database = getAdminFirestore();
    const profileRef = database.collection("users").doc(user.uid);
    const handleRef = database.collection("handles").doc(parsed.data.handle);

    await database.runTransaction(async (transaction) => {
      const [profileSnapshot, handleSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(handleRef),
      ]);
      const previousHandle = profileSnapshot.data()?.handle as string | undefined;
      const demoLabel = profileSnapshot.data()?.demoLabel as string | undefined;
      if (handleSnapshot.exists && handleSnapshot.data()?.uid !== user.uid) {
        throw new Error("HANDLE_TAKEN");
      }

      if (previousHandle && previousHandle !== parsed.data.handle) {
        transaction.delete(database.collection("handles").doc(previousHandle));
      }
      transaction.set(handleRef, { uid: user.uid, updatedAt: FieldValue.serverTimestamp() });
      // Replace the document so legacy/private fields can never linger in the
      // publicly readable users collection. Roles live in custom claims or the
      // server-only roleAssignments collection.
      transaction.set(
        profileRef,
        {
          ...parsed.data,
          visibility: "public",
          ...(demoLabel ? { demoLabel } : {}),
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: profileSnapshot.exists
            ? profileSnapshot.data()?.createdAt
            : FieldValue.serverTimestamp(),
        },
      );
    });

    return ok({ uid: user.uid, profile: parsed.data });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return fail({ code: error.code, message: error.message }, 401);
    }
    if (error instanceof Error && error.message === "HANDLE_TAKEN") {
      return fail({ code: "handle_taken", message: "That scout handle is already taken." }, 409);
    }
    return fail({ code: "profile_write_failed", message: "We could not save your profile." }, 500);
  }
}
