import type { DecodedIdToken } from "firebase-admin/auth";

import { getAdminAppCheck, getAdminAuth } from "../firebase/admin";

export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly code: "missing_token" | "invalid_token" | "missing_app_check" | "invalid_app_check",
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export type AuthenticatedRequest = {
  user: DecodedIdToken;
  appId?: string;
};

type RequestWithHeaders = {
  headers: Headers;
};

export type RequestVerificationServices = {
  verifyIdToken: (token: string, checkRevoked: boolean) => Promise<DecodedIdToken>;
  verifyAppCheckToken: (token: string) => Promise<{ appId: string }>;
};

function getDefaultServices(): RequestVerificationServices {
  return {
    verifyIdToken: (token, checkRevoked) =>
      getAdminAuth().verifyIdToken(token, checkRevoked),
    verifyAppCheckToken: async (token) => {
      const verified = await getAdminAppCheck().verifyToken(token);
      return { appId: verified.appId };
    },
  };
}

function requiresAppCheck(): boolean {
  // Production cannot opt out through a copied local environment file.
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  return process.env.APP_CHECK_ENFORCEMENT_ENABLED === "true";
}

export async function verifyAuthenticatedRequest(
  request: RequestWithHeaders,
  services: RequestVerificationServices = getDefaultServices(),
): Promise<AuthenticatedRequest> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthenticationError("Sign in is required.", "missing_token");
  }

  let user: DecodedIdToken;
  try {
    user = await services.verifyIdToken(authorization.slice("Bearer ".length), true);
  } catch {
    throw new AuthenticationError("Your session is invalid or expired.", "invalid_token");
  }

  const appCheckToken = request.headers.get("x-firebase-appcheck");
  if (!appCheckToken) {
    if (requiresAppCheck()) {
      throw new AuthenticationError("App verification is required.", "missing_app_check");
    }
    return { user };
  }

  try {
    const verified = await services.verifyAppCheckToken(appCheckToken);
    return { user, appId: verified.appId };
  } catch {
    throw new AuthenticationError("App verification failed.", "invalid_app_check");
  }
}
