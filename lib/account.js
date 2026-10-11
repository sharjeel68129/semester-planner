// Accounts and saved events (browser side). Supabase handles login; events and settings live in the `planners` table.
import { createBrowserClient } from "@supabase/ssr";
import { makeEvent } from "./schema";
import { makeSettings } from "./settings";

// These two are public by design (they ship to the browser); the row level security rules in
// supabase/schema.sql are what protect the data. Unlike GEMINI_API_KEY, they are safe to expose.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the Supabase values are in .env.local; until then nobody can sign in or open the planner. */
export const accountsEnabled = Boolean(url && key);

let client;
export function supabase() {
  return (client ||= createBrowserClient(url, key));
}

/**
 * The signed-in student's saved events ([] if none yet) and settings (defaults if none yet).
 * Throws if they could not be read. `settingsAvailable` is false on a database that does not have the
 * `settings` column yet (supabase/schema.sql not re-run): events still load and settings use the defaults.
 */
export async function loadPlanner() {
  let settingsAvailable = true;
  let { data, error } = await supabase().from("planners").select("events, settings").maybeSingle();
  if (error) {
    settingsAvailable = false;
    ({ data, error } = await supabase().from("planners").select("events").maybeSingle());
  }
  if (error) throw new Error(error.message);
  // Stored data is checked like any other input before it is used.
  const events = Array.isArray(data?.events) ? data.events.filter((e) => e && typeof e === "object").map(makeEvent) : [];
  return { events, settings: makeSettings(data?.settings), settingsAvailable };
}

/** Replace the student's saved events with this list. Leaves their settings alone. Throws if the save did not happen. */
export async function saveEvents(userId, events) {
  const { error } = await supabase()
    .from("planners")
    .upsert({ user_id: userId, events, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Save the student's settings. Writes only that column, so it can never overwrite their events. */
export async function saveSettings(userId, settings) {
  const { error } = await supabase().from("planners").upsert({ user_id: userId, settings });
  if (error) throw new Error(error.message);
}

/**
 * Permanently delete the signed-in student's account and saved events. The database itself checks the password
 * (see delete_my_account in supabase/schema.sql). Returns false, and deletes nothing, if the password is wrong.
 */
export async function deleteAccount(password) {
  const { data, error } = await supabase().rpc("delete_my_account", { password });
  if (error) throw new Error(error.message);
  return data === true;
}
