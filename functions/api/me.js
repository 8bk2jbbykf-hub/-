import { getCurrentUser, handleOptions, json } from "../_shared.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "GET") return json({ ok: false, error: "Method Not Allowed" }, 405);
  const user = await getCurrentUser(env, request);
  if (!user) return json({ ok: false, user: null });
  return json({ ok: true, user: { id: user.id, email: user.email, nickname: user.nickname } });
}
