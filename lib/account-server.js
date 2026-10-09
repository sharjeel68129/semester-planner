// Accounts (server side): lets a route handler ask "who is making this request?".
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const accountsEnabled = Boolean(url && key);

/** The signed-in user for this request, or null. Asks Supabase to verify the session; the cookie alone is not trusted. */
export async function getUser() {
  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
