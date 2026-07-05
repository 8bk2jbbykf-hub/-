import { getCookie, handleOptions, json, sha256 } from "../../_shared.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, 405);
  const token = getCookie(request, "graduate_session");
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return json({ ok: true, message: "已退出登录" }, 200, {
    "set-cookie": "graduate_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  });
}
