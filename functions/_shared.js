export const allowedDifficulties = ["easy", "normal", "hard"];
export const allowedTopics = ["potato_zinc", "salt_stress", "drought_stress", "disease_resistance", "nutrient_uptake"];
export const allowedEndings = ["延毕", "勉强通过", "顺利毕业", "优秀毕业", "科研新星", "精神崩溃", "植物全灭", "经费枯竭", "导师彻底失望"];
export const statKeys = ["energy", "mood", "plantHealth", "experimentProgress", "dataQuality", "literatureUnderstanding", "paperProgress", "advisorSatisfaction"];

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

export async function readJson(request, limit = 260000) {
  const text = await request.text();
  if (text.length > limit) throw new Error("请求体过大");
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error("JSON 格式不正确");
  }
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function isEmail(value) {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,20}$/.test(String(value || ""));
}

export function getIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

export function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomId() {
  return crypto.randomUUID();
}

export async function checkRateLimit(env, key, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();
  if (!row || Number(row.reset_at) <= now) {
    await env.DB.prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)").bind(key, 1, now + windowSeconds).run();
    return { ok: true };
  }
  if (Number(row.count) >= limit) return { ok: false, error: "操作过于频繁，请稍后再试" };
  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return { ok: true };
}

export async function verifyTurnstile(env, token, request) {
  if (env.MOCK_TURNSTILE === "true") return { ok: true };
  if (!env.TURNSTILE_SECRET_KEY) return { ok: false, error: "Turnstile 未配置" };
  if (!token || String(token).length > 2048) return { ok: false, error: "请先完成人机验证" };
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  form.append("remoteip", getIp(request));
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  return data?.success ? { ok: true } : { ok: false, error: "人机验证失败" };
}

export function validateNickname(value) {
  const name = String(value || "").trim();
  if (name.length < 1 || name.length > 12) return null;
  if (/[<>"'`]/.test(name) || /<\/?[a-z][\s\S]*>/i.test(name)) return null;
  return name;
}

export function validateGameSummary(gameSummary, score, ending) {
  if (!gameSummary || typeof gameSummary !== "object") return "游戏摘要缺失";
  if (!Number.isInteger(gameSummary.day) || gameSummary.day < 1 || gameSummary.day > 30) return "游戏天数异常";
  if (!Number.isInteger(gameSummary.actionsCount) || gameSummary.actionsCount < 1 || gameSummary.actionsCount > 120) return "行动次数异常";
  if (!Number.isInteger(score) || score < 0 || score > 100) return "分数异常";
  const stats = gameSummary.finalStats;
  if (!stats || typeof stats !== "object") return "最终数值缺失";
  for (const key of statKeys) {
    if (typeof stats[key] !== "number" || stats[key] < 0 || stats[key] > 100) return `${key} 数值异常`;
  }
  if (!Number.isInteger(gameSummary.failedExperiments) || gameSummary.failedExperiments < 0 || gameSummary.failedExperiments > 50) return "失败实验次数异常";
  const normalEnding =
    (score < 50 && ending === "延毕") ||
    (score >= 50 && score <= 64 && ending === "勉强通过") ||
    (score >= 65 && score <= 79 && ending === "顺利毕业") ||
    (score >= 80 && score <= 89 && ending === "优秀毕业") ||
    (score >= 90 && ending === "科研新星");
  const specialEnding =
    (ending === "精神崩溃" && stats.mood <= 5) ||
    (ending === "植物全灭" && stats.plantHealth <= 5) ||
    (ending === "导师彻底失望" && stats.advisorSatisfaction <= 12) ||
    (ending === "经费枯竭") ||
    (ending === "延毕" && score < 55);
  if (!normalEnding && !specialEnding) return "结局和分数不匹配";
  return "";
}

export async function getCurrentUser(env, request) {
  const token = getCookie(request, "graduate_session");
  if (!token || token.length > 256) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT users.id, users.email, users.nickname, sessions.id AS session_id FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token_hash = ? AND sessions.expires_at > ?"
  ).bind(tokenHash, now).first();
  return row || null;
}

export function sessionCookie(token, maxAge = 2592000) {
  return `graduate_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
