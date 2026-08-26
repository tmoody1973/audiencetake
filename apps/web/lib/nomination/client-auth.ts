"use client";

import { getClientAppCheckToken, getClientAuth } from "../firebase/client";

export async function nominationCommandHeaders(): Promise<Record<string, string>> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sign in before starting scout research.");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${await user.getIdToken()}`,
  };
  const appCheckToken = await getClientAppCheckToken();
  if (appCheckToken) headers["x-firebase-appcheck"] = appCheckToken;
  return headers;
}
