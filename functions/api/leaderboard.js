import { allowedDifficulties, allowedEndings, allowedTopics, checkRateLimit, getIp, handleOptions, isUuid, json, readJson, randomId, validateGameSummary, validateNickname, verifyTurnstile } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method === "GET") return getLeaderboard(request, env);
  if (request.method === "POST") return postLeaderboard(request, env);
  return json({ ok: false, error: "Method Not Allowed" }, 405);
}

async function getLeaderboard(request, env) {
  const url = new URL(request.url);
  const difficulty = url.searchParams.get("difficulty") || "";
  const topic = url.searchParams.get("topic") || "";
  if (difficulty && !allowedDifficulties.includes(difficulty)) return json({ ok: false, error: "非法难度" }, 400);
  if (topic && !allowedTopics.includes(topic)) return json({ ok: false, error: "非法研究方向" }, 400);
  let sql = "SELECT nickname, score, ending, topic, difficulty, created_at FROM leaderboard";
  const clauses = [];
  const binds = [];
  if (difficulty) { clauses.push("difficulty = ?"); binds.push(difficulty); }
  if (topic) { clauses.push("topic = ?"); binds.push(topic); }
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += " ORDER BY score DESC, created_at ASC LIMIT 50";
  const result = await env.DB.prepare(sql).bind(...binds).all();
  const items = (result.results || []).map((row, index) => ({
    rank: index + 1,
    nickname: row.nickname,
    score: row.score,
    ending: row.ending,
    topic: row.topic,
    difficulty: row.difficulty,
    createdAt: row.created_at
  }));
  return json({ ok: true, items });
}

async function postLeaderboard(request, env) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ ok: false, error: error.message }, 400);
  }
  const guestId = String(body.guestId || "");
  const nickname = validateNickname(body.nickname);
  const score = Number(body.score);
  const ending = String(body.ending || "");
  const topic = String(body.topic || "");
  const difficulty = String(body.difficulty || "");
  if (!isUuid(guestId)) return json({ ok: false, error: "guestId 不合法" }, 400);
  if (!nickname) return json({ ok: false, error: "昵称需为 1-12 个字符，且不能包含危险字符" }, 400);
  if (!Number.isInteger(score) || score < 0 || score > 100) return json({ ok: false, error: "分数不合法" }, 400);
  if (!allowedDifficulties.includes(difficulty)) return json({ ok: false, error: "难度不合法" }, 400);
  if (!allowedTopics.includes(topic)) return json({ ok: false, error: "研究方向不合法" }, 400);
  if (!allowedEndings.includes(ending)) return json({ ok: false, error: "结局不合法" }, 400);
  const summaryError = validateGameSummary(body.gameSummary, score, ending);
  if (summaryError) return json({ ok: false, error: summaryError }, 400);
  const summaryText = JSON.stringify(body.gameSummary);
  if (summaryText.length > 20000) return json({ ok: false, error: "游戏摘要过大" }, 400);
  const ip = getIp(request);
  const guestLimit = await checkRateLimit(env, `leaderboard:guest:${guestId}`, 1, 60);
  if (!guestLimit.ok) return json({ ok: false, error: guestLimit.error }, 429);
  const ipLimit = await checkRateLimit(env, `leaderboard:ip:${ip}`, 5, 60);
  if (!ipLimit.ok) return json({ ok: false, error: ipLimit.error }, 429);
  const turnstile = await verifyTurnstile(env, body.turnstileToken, request);
  if (!turnstile.ok) return json({ ok: false, error: turnstile.error }, 403);
  try {
    await env.DB.prepare(
      "INSERT INTO leaderboard (id, user_id, guest_id, nickname, score, ending, topic, difficulty, game_summary) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(randomId(), guestId, nickname, score, ending, topic, difficulty, summaryText).run();
    return json({ ok: true, message: "排行榜提交成功" });
  } catch {
    return json({ ok: false, error: "排行榜提交失败，请稍后再试" }, 500);
  }
}
