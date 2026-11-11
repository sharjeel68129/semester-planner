// Accounts (server side): lets a route handler ask "who is making this request?".
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const accountsEnabled = Boolean(url && key);

/** A Supabase client acting as the student who sent this request (their session cookie), never as an admin. */
async function requestClient() {
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}

/** The signed-in user for this request, or null. Asks Supabase to verify the session; the cookie alone is not trusted. */
export async function getUser() {
  const { data } = await (await requestClient()).auth.getUser();
  return data.user ?? null;
}

/**
 * A large outline the browser put in the private `outlines` bucket (supabase/storage.sql). Read once, then deleted
 * at once, so no file stays stored. Only the student's own folder is allowed: storage rules enforce it too.
 * Returns a Buffer, or throws with a plain reason.
 */
export async function takeStoredOutline(user, path) {
  if (typeof path !== "string" || !path.startsWith(`${user.id}/`) || path.includes("..")) {
    throw new Error("could not find the uploaded file");
  }
  const supabase = await requestClient();
  const bucket = supabase.storage.from("outlines");
  const { data, error } = await bucket.download(path);
  // Deleted whether or not the download worked, so a failed reading leaves nothing behind.
  await bucket.remove([path]).catch(() => {});
  if (error || !data) throw new Error("could not find the uploaded file");
  return Buffer.from(await data.arrayBuffer());
}
