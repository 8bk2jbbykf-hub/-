import { checkRateLimit, getIp, handleOptions, isEmail, json, randomId, readJson, sha256, verifyTurnstile } from "../../_shared.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, 405);
  let body;
  try { body = await readJson(request, 10000); } catch (error) { return json({ ok: false, error: error.message }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!isEmail(email) || email.length > 254) return json({ ok: false, error: "邮箱格式不正确" }, 400);
  const turnstile = await verifyTurnstile(env, body.turnstileToken, request);
  if (!turnstile.ok) return json({ ok: false, error: turnstile.error }, 403);
  const emailLimit = await checkRateLimit(env, `auth:email:${email}`, 3, 600);
  if (!emailLimit.ok) return json({ ok: false, error: emailLimit.error }, 429);
  const ipLimit = await checkRateLimit(env, `auth:ip:${getIp(request)}`, 10, 600);
  if (!ipLimit.ok) return json({ ok: false, error: ipLimit.error }, 429);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const salt = randomId();
  const hash = await sha256(`${salt}:${code}`);
  await env.DB.prepare("INSERT OR REPLACE INTO login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)")
    .bind(email, `${salt}:${hash}`, Math.floor(Date.now() / 1000) + 600).run();
  await sendEmailCode(email, code);
  return json({ ok: true, message: "验证码已发送", ...(env.MOCK_TURNSTILE === "true" ? { devCode: code } : {}) });
}

async function sendEmailCode(_email, _code) {
  // TODO: 接入邮件服务，例如 Resend、MailChannels 或 Cloudflare Email Workers。
}
