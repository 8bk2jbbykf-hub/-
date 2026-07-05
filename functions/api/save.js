import { getCurrentUser, handleOptions, json, randomId, readJson } from "../_shared.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return handleOptions();
  const user = await getCurrentUser(env, request);
  if (!user) return json({ ok: false, error: "请先登录" }, 401);
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT save_data, updated_at FROM cloud_saves WHERE user_id = ?").bind(user.id).first();
    return json({ ok: true, saveData: row ? JSON.parse(row.save_data) : null, updatedAt: row?.updated_at || null });
  }
  if (request.method === "POST") {
    let body;
    try { body = await readJson(request, 220000); } catch (error) { return json({ ok: false, error: error.message }, 400); }
    const text = JSON.stringify(body.saveData || {});
    if (text.length > 200000) return json({ ok: false, error: "存档不能超过 200KB" }, 400);
    await env.DB.prepare(
      "INSERT INTO cloud_saves (id, user_id, save_data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET save_data = excluded.save_data, updated_at = CURRENT_TIMESTAMP"
    ).bind(randomId(), user.id, text).run();
    return json({ ok: true, message: "云端存档已保存" });
  }
  return json({ ok: false, error: "Method Not Allowed" }, 405);
}
