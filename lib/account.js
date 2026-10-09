// Accounts and saved events (browser side). Supabase handles login; events live in the `planners` table.
import { createBrowserClient } from "@supabase/ssr";
import { makeEvent } from "./schema";

// These two are public by design (they ship to the browser); the row level security rules in
// supabase/schema.sql are what protect the data. Unlike GEMINI_API_KEY, they are safe to expose.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the Supabase values are in .env.local; the app then runs without login and saves nothing. */
export const accountsEnabled = Boolean(url && key);

let client;
export function supabase() {
  return (client ||= createBrowserClient(url, key));
}

/** The signed-in student's saved events ([] if they have none yet). Throws if they could not be read. */
export async function loadEvents() {
  const { data, error } = await supabase().from("planners").select("events").maybeSingle();
  if (error) throw new Error(error.message);
  // Stored data is checked like any other input before it is used as Event[].
  return Array.isArray(data?.events) ? data.events.filter((e) => e && typeof e === "object").map(makeEvent) : [];
}

/** Replace the student's saved events with this list. Throws if the save did not happen. */
export async function saveEvents(userId, events) {
  const { error } = await supabase()
    .from("planners")
    .upsert({ user_id: userId, events, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
