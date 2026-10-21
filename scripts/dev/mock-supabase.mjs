// In-memory stand-in for Supabase (sign-in, the planners table, delete_my_account), for checking screens locally. Port 54399.
import http from "node:http";
import crypto from "node:crypto";

const PORT = 54399;
const users = new Map(); // id -> { id, email, password, new_email }
const sessions = new Map(); // access token -> user id
const refresh = new Map(); // refresh token -> user id
const rows = new Map(); // user id -> { events, settings }
const recovery = new Map(); // token_hash -> user id
const state = { noSettings: false, confirm: true, log: [] };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", exp, n: crypto.randomUUID() })}.sig`;
  const refreshToken = crypto.randomUUID();
  sessions.set(access, user.id);
  refresh.set(refreshToken, user.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: refreshToken, user: view(user) };
}
const view = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, new_email: u.new_email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const send = (status, body) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": req.headers.origin || "*",
        "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-credentials": "true",
      });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return send(204);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const me = users.get(sessions.get(token));
    const path = url.pathname;
    state.log.push(`${req.method} ${path}${url.search}`);

    if (path === "/__state") return send(200, { users: [...users.values()], rows: [...rows], recovery: [...recovery], noSettings: state.noSettings, log: state.log.slice(-40) });
    if (path === "/__confirm-email") { for (const u of users.values()) if (u.new_email) { u.email = u.new_email; delete u.new_email; } return send(200, {}); }
    if (path === "/__set") { Object.assign(state, body); return send(200, state.noSettings); }

    if (path === "/auth/v1/signup") {
      if ([...users.values()].some((u) => u.email === body.email)) return send(400, { msg: "User already registered" });
      const user = { id: crypto.randomUUID(), email: body.email, password: body.password };
      users.set(user.id, user);
      if (state.confirm) return send(200, view(user)); // email confirmation on: no session yet
      return send(200, session(user));
    }
    if (path === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const user = [...users.values()].find((u) => u.email === body.email && u.password === body.password);
      return user ? send(200, session(user)) : send(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
    }
    if (path === "/auth/v1/token") {
      const user = users.get(refresh.get(body.refresh_token));
      return user ? send(200, session(user)) : send(400, { msg: "Invalid Refresh Token" });
    }
    if (path === "/auth/v1/recover") {
      const user = [...users.values()].find((u) => u.email === body.email);
      if (user) recovery.set(`hash-${crypto.randomUUID()}`, user.id);
      return send(200, {});
    }
    if (path === "/auth/v1/verify") {
      const user = users.get(recovery.get(body.token_hash));
      if (!user || body.type !== "recovery") return send(403, { error_code: "otp_expired", msg: "Email link is invalid or has expired" });
      recovery.delete(body.token_hash);
      return send(200, session(user));
    }
    if (path === "/auth/v1/logout") return send(204);
    if (path === "/auth/v1/user") {
      if (!me) return send(401, { msg: "invalid JWT" });
      if (req.method === "PUT") {
        if (body.password) {
          if (body.password.length < 8) return send(422, { msg: "Password should be at least 8 characters" });
          me.password = body.password;
        }
        if (body.email) me.new_email = body.email; // changes only after the confirmation link, which the mock never sends
      }
      return send(200, view(me));
    }

    if (path === "/rest/v1/planners") {
      if (!me) return send(401, { message: "JWT required" });
      if (req.method === "GET") {
        if (state.noSettings && (url.searchParams.get("select") || "").includes("settings")) {
          return send(400, { code: "42703", message: "column planners.settings does not exist" });
        }
        const row = rows.get(me.id);
        const cols = (url.searchParams.get("select") || "").split(",").map((c) => c.trim());
        const out = row ? [Object.fromEntries(cols.map((c) => [c, row[c]]))] : [];
        if ((req.headers.accept || "").includes("vnd.pgrst.object")) return out.length ? send(200, out[0]) : send(406, { code: "PGRST116", message: "0 rows" });
        return send(200, out);
      }
      if (req.method === "POST") {
        const item = Array.isArray(body) ? body[0] : body;
        if (state.noSettings && "settings" in item) return send(400, { code: "PGRST204", message: "Could not find the 'settings' column" });
        if (item.user_id !== me.id) return send(403, { message: "row level security" });
        const row = rows.get(me.id) || { events: [], settings: {} };
        if ("events" in item) row.events = item.events;
        if ("settings" in item) row.settings = item.settings;
        rows.set(me.id, row);
        return send(201);
      }
    }
    if (path === "/rest/v1/rpc/delete_my_account") {
      if (!me) return send(401, { message: "JWT required" });
      if (body.password !== me.password) return send(200, false);
      users.delete(me.id);
      rows.delete(me.id);
      return send(200, true);
    }
    send(404, { message: `mock has no ${req.method} ${path}` });
  })
  .listen(PORT, () => console.log(`mock supabase on ${PORT}`));
