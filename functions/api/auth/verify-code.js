import { handleOptions, isEmail, json, randomId, readJson, sessionCookie, sha256 } from "../../_shared.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, 405);
  let body;
  try { body = await readJson(request, 10000); } catch (error) { return json({ ok: false, error: error.message }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "");
  if (!isEmail(email) || email.length > 254) return json({ ok: false, error: "邮箱格式不正确" }, 400);
  if (!/^\d{6}$/.test(code)) return json({ ok: false, error: "验证码格式不正确" }, 400);
  const row = await env.DB.prepare("SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?").bind(email).first();
  if (!row) return json({ ok: false, error: "请先获取验证码" }, 400);
  if (Number(row.expires_at) < Math.floor(Date.now() / 1000)) return json({ ok: false, error: "验证码已过期" }, 400);
  if (Number(row.attempts) >= 5) return json({ ok: false, error: "尝试次数过多，请重新获取验证码" }, 429);
  const [salt, stored] = String(row.code_hash).split(":");
  const actual = await sha256(`${salt}:${code}`);
  if (actual !== stored) {
    await env.DB.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
    return json({ ok: false, error: "验证码错误" }, 400);
  }
  let user = await env.DB.prepare("SELECT id, email, nickname FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    const id = randomId();
    await env.DB.prepare("INSERT INTO users (id, email, nickname, last_login_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)").bind(id, email, email.split("@")[0].slice(0, 12)).run();
    user = { id, email, nickname: email.split("@")[0].slice(0, 12) };
  } else {
    await env.DB.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
  }
  await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
  const token = randomId() + "." + randomId();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(randomId(), user.id, await sha256(token), Math.floor(Date.now() / 1000) + 2592000).run();
  return json({ ok: true, user: { id: user.id, email: user.email, nickname: user.nickname } }, 200, { "set-cookie": sessionCookie(token) });
}
