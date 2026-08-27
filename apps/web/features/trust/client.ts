import { getClientAppCheckToken, getClientAuth } from "@/lib/firebase/client";

type CommandMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function trustCommand<T>(
  path: string,
  method: CommandMethod,
  input?: unknown,
): Promise<T> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sign in to continue.");
  const headers = new Headers({ authorization: `Bearer ${await user.getIdToken()}` });
  const appCheck = await getClientAppCheckToken();
  if (appCheck) headers.set("x-firebase-appcheck", appCheck);
  const isForm = input instanceof FormData;
  if (input !== undefined && !isForm) headers.set("content-type", "application/json");

  const response = await fetch(path, {
    method,
    headers,
    body: input === undefined ? undefined : isForm ? input : JSON.stringify(input),
  });
  const envelope = await response.json() as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || !envelope.ok) {
    throw new Error(envelope.error?.message ?? "That request could not be saved.");
  }
  return envelope.data as T;
}
