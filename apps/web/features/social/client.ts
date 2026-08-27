import { getClientAppCheckToken, getClientAuth } from "../../lib/firebase/client";

export async function socialCommand<T>(path: string, method: "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sign in to participate.");
  const headers = new Headers({ "content-type": "application/json", authorization: `Bearer ${await user.getIdToken()}` });
  const appCheck = await getClientAppCheckToken();
  if (appCheck) headers.set("x-firebase-appcheck", appCheck);
  const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const envelope = (await response.json()) as { ok?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !envelope.ok) throw new Error(envelope.error?.message ?? "That action could not be saved.");
  return envelope.data as T;
}
