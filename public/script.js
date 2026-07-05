"use strict";

const TURNSTILE_SITE_KEY = window.TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
const periods = ["上午", "下午", "晚上", "深夜"];
const stages = ["播种与培养", "胁迫处理", "取样", "生理指标测定", "RNA 提取", "qPCR 分析", "数据整理", "作图与统计", "论文撰写", "预答辩准备"];
const topics = {
  potato_zinc: ["马铃薯锌胁迫", "生理指标和元素吸收数据更重要，默认推荐方向。"],
  salt_stress: ["盐胁迫", "表型明显，植物健康下降更快，数据质量提升更快。"],
  drought_stress: ["干旱胁迫", "植物容易萎蔫，需要频繁照顾，但管理好成功率高。"],
  disease_resistance: ["病害抗性", "随机性强，污染风险高，成功后进度提升明显。"],
  nutrient_uptake: ["营养元素吸收", "研究链条长，文献理解要求高，数据质量上限高。"]
};
const difficulties = {
  easy: { name: "摸鱼模式", funding: 1200, pressure: .75, event: .2, advisor: .8 },
  normal: { name: "普通模式", funding: 900, pressure: 1, event: .32, advisor: 1 },
  hard: { name: "地狱模式", funding: 650, pressure: 1.28, event: .45, advisor: 1.22 }
};
const advisorTypes = ["温和但突然袭击型", "逻辑洁癖型", "进度雷达型", "鼓励后补刀型"];
const taglines = ["白天养植物，晚上改论文，凌晨等导师消息。", "你的植物会死，你的数据会乱，但你还是要毕业。", "这不是摸鱼模拟器，这是植物方向研究生的真实生存挑战。", "从播种到答辩，看看你能不能顺利毕业。", "实验可以失败，但毕业系统不会等你。"];
const phrasePool = {
  pressure: ["你来一下我办公室。", "你最近进展怎么样？", "这个事情今天能不能给我一个结果？", "你先整理一下，明天组会讲。"],
  critique: ["你这个数据，支撑不了你的结论。", "这个图重新做一下，不够规范。", "你这个显著性是怎么算的？", "你不能为了显著而显著。", "实验设计要有逻辑，不是想到哪做到哪。"],
  guide: ["这个问题你先查查文献。", "你不要只看表型，要想机制。", "论文不能只堆数据，要讲故事。", "你要有自己的科学问题。", "你要站在审稿人的角度想问题。"],
  extra: ["这个结果不太理想，你再补一组实验。", "你这个实验最好再重复一次。", "为什么选这个时间点取样？", "你这个重复数够不够？"],
  encourage: ["你这个结果挺有意思，可以继续挖。", "这个方向还是有意义的，但你要再深入一点。", "不要慌，先把数据理清楚。", "这个可以写进论文，但表达要谨慎。", "先别急着下结论。"]
};
const actions = [
  ["carePlant", "照顾植物", "健康、心态↑"],
  ["sow", "播种与换盆", "前期进度↑"],
  ["stress", "胁迫处理", "进度、数据↑ 健康↓"],
  ["sample", "取样", "样本、数据↑"],
  ["physiology", "测生理指标", "消耗经费，数据↑"],
  ["rna", "RNA 提取", "消耗经费，有降解风险"],
  ["qpcr", "qPCR 分析", "高成本高收益"],
  ["organize", "整理数据", "数据、论文↑"],
  ["stats", "作图与统计", "论文图表推进"],
  ["read", "读文献", "理解↑ 心态↓"],
  ["write", "写论文", "论文↑ 心态↓"],
  ["advisor", "找导师汇报", "满意度变化"],
  ["funding", "申请经费或报销", "经费↑"],
  ["help", "帮同门", "心态与随机收益"],
  ["rest", "休息", "恢复但压力↑"],
  ["overnight", "熬夜爆肝", "高收益高风险"]
];
let gameState = null;
let selectedTopic = "potato_zinc";
let selectedDifficulty = "normal";
let turnstileToken = "";

const $ = (id) => document.getElementById(id);
function clampValue(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $(id).classList.add("active");
}
function openModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalContent").innerHTML = html;
  $("modal").showModal();
}

function initGame() {
  $("tagline").textContent = taglines[randomInt(0, taglines.length - 1)];
  getOrCreateGuestId();
  renderSetupCards();
  bindUI();
  apiHealthCheck();
}
function showHomeScreen() { showScreen("homeScreen"); }
function renderSetupCards() {
  $("topicCards").innerHTML = Object.entries(topics).map(([key, value]) => `<button class="choice-card" data-topic="${key}"><strong>${value[0]}${key === "potato_zinc" ? " · 推荐" : ""}</strong><small>${value[1]}</small></button>`).join("");
  $("difficultyCards").innerHTML = Object.entries(difficulties).map(([key, value]) => `<button class="choice-card" data-difficulty="${key}"><strong>${value.name}</strong><small>经费 ${value.funding}，随机事件 ${Math.round(value.event * 100)}%，导师强度 ${value.advisor}x</small></button>`).join("");
}
function bindUI() {
  document.body.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "start") startNewGame();
    if (action === "continue") continueGame();
    if (action === "leaderboard") showLeaderboard();
    if (action === "saves") showSaveModal();
    if (action === "settings") showSettings();
    if (action === "about") showAbout();
    if (btn.classList.contains("back-home")) showHomeScreen();
    if (btn.dataset.topic) selectResearchTopic(btn.dataset.topic);
    if (btn.dataset.difficulty) selectDifficulty(btn.dataset.difficulty);
    if (btn.dataset.gameAction) applyAction(btn.dataset.gameAction);
    if (btn.dataset.response) handleOfficeResponse(btn.dataset.response);
  });
  $("closeModal").onclick = () => $("modal").close();
  $("saveBtn").onclick = () => saveLocalGame(gameState);
  $("continueBtn").onclick = continueGame;
  $("clearSaveBtn").onclick = clearLocalSave;
  $("exportBtn").onclick = exportLocalSave;
  $("importInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importLocalSave(await file.text());
    e.target.value = "";
  };
  $("loginBtn").onclick = showLoginModal;
}
function startNewGame() {
  selectedTopic = "potato_zinc";
  selectedDifficulty = "normal";
  showScreen("setupScreen");
}
function selectResearchTopic(topic) {
  selectedTopic = topic;
  showToast(`研究方向：${topics[topic][0]}`);
}
function selectDifficulty(difficulty) {
  selectedDifficulty = difficulty;
  const d = difficulties[difficulty];
  gameState = {
    day: 1, period: "上午", difficulty, selectedResearchTopic: selectedTopic,
    energy: 80, mood: 75, plantHealth: 80, experimentProgress: 0, dataQuality: 0,
    literatureUnderstanding: 10, paperProgress: 0, advisorSatisfaction: 60,
    funding: d.funding, graduationPressure: 20, samples: 0, failedExperiments: 0,
    logs: [], currentStage: stages[0], advisorType: advisorTypes[randomInt(0, advisorTypes.length - 1)],
    lastAdvisorPhrase: "你已经是个研究生了，要学会自己想办法。",
    officeEventActive: false, extraExperimentRequired: false, extraExperimentProgress: 0,
    advisorPressureLevel: 1, daysWithoutProgress: 0, actionsCount: 0, gameOver: false,
    flags: { rnaDone: false, blockedAction: "", extraCost: 0, restStreak: 0 }
  };
  addLog(`开题方向确定为${topics[selectedTopic][0]}，导师类型：${gameState.advisorType}。`);
  showScreen("gameScreen");
  updateUI();
}
function continueGame() {
  const save = loadLocalSave();
  if (!save || !save.gameState) return showToast("没有找到本地存档。");
  gameState = save.gameState;
  showScreen("gameScreen");
  updateUI();
  showToast("已继续本地存档。");
}
function canDo(action) {
  if (!gameState) return "尚未开始";
  if (gameState.flags.blockedAction === action) return "设备被占用";
  if (action === "stress" && gameState.experimentProgress < 8) return "请先播种与培养";
  if (action === "physiology" && gameState.samples < 1) return "需要样本";
  if (action === "rna" && gameState.samples < 1) return "需要先取样";
  if (action === "qpcr" && !gameState.flags.rnaDone) return "需要先完成 RNA 提取";
  const cost = action === "qpcr" ? 150 : action === "rna" ? 120 : action === "physiology" ? 80 : 0;
  if (gameState.funding < cost + (gameState.flags.extraCost || 0)) return "经费不足";
  return "";
}
function applyAction(actionType) {
  if (!gameState || gameState.gameOver) return;
  const reason = canDo(actionType);
  if (reason) return showToast(reason);
  const before = gameState.experimentProgress + gameState.dataQuality + gameState.paperProgress;
  gameState.actionsCount += 1;
  gameState.flags.blockedAction = "";
  gameState.flags.restStreak = actionType === "rest" ? gameState.flags.restStreak + 1 : 0;
  const add = (key, value) => gameState[key] = clampValue(gameState[key] + value, 0, key === "funding" ? 9999 : 100);
  const cost = (amount) => { gameState.funding = Math.max(0, gameState.funding - amount - (gameState.flags.extraCost || 0)); gameState.flags.extraCost = 0; };
  let msg = "";
  if (actionType === "carePlant") { add("plantHealth", randomInt(gameState.plantHealth < 40 ? 14 : 8, 18)); add("mood", randomInt(1, 4)); add("energy", -5); msg = "你给马铃薯幼苗浇水、调光，还顺手安慰了自己。"; }
  if (actionType === "sow") { add("experimentProgress", randomInt(5, 10)); add("plantHealth", randomInt(3, 8)); add("energy", -8); msg = "播种、换盆、贴标签，你再次相信标签不会掉。"; }
  if (actionType === "stress") { add("experimentProgress", randomInt(8, 15)); add("dataQuality", randomInt(3, 8)); add("plantHealth", -randomInt(8, 18)); add("energy", -10); msg = "胁迫处理完成，植物看起来也感受到了毕业压力。"; if (gameState.plantHealth < 25 && Math.random() < .35) failExperiment("胁迫过猛，植物全体沉默。"); }
  if (actionType === "sample") { const gain = randomInt(1, 3); gameState.samples += gain; add("experimentProgress", randomInt(6, 12)); add("dataQuality", randomInt(gameState.plantHealth < 40 ? 2 : 4, 10)); add("energy", -8); msg = `取样 ${gain} 份，编号暂时看起来很可靠。`; if (Math.random() < .08) { add("dataQuality", -8); msg += " 但有一管标签开始挑战你的记忆。"; } }
  if (actionType === "physiology") { cost(80); add("experimentProgress", randomInt(8, 14)); add("dataQuality", randomInt(6, 12)); add("energy", -10); msg = "生理指标测完，Excel 表格开始长出第二层表头。"; }
  if (actionType === "rna") { cost(120); gameState.flags.rnaDone = true; add("experimentProgress", randomInt(8, 16)); add("dataQuality", randomInt(5, 12)); add("energy", -12); msg = "RNA 提取完成，你对冰盒产生了短暂信仰。"; if (Math.random() < .16) { add("dataQuality", -10); gameState.failedExperiments++; msg += " 可惜有一部分 RNA 降解了。"; } }
  if (actionType === "qpcr") { cost(150); add("experimentProgress", randomInt(10, 18)); add("dataQuality", randomInt(8, 15)); add("energy", -14); msg = "qPCR 跑完，扩增曲线像导师的眉头一样复杂。"; if (Math.random() < .14) { add("dataQuality", -8); add("literatureUnderstanding", 3); msg += " 内参不稳定，你被迫重新理解方法学。"; } }
  if (actionType === "organize") { add("dataQuality", randomInt(gameState.experimentProgress > 50 ? 11 : 8, 15)); add("paperProgress", randomInt(3, 6)); add("energy", -8); msg = "你整理了数据，发现最大的问题不是数据，而是文件名。"; resolveExtraExperiment(); }
  if (actionType === "stats") { add("dataQuality", randomInt(6, 12)); add("paperProgress", randomInt(5, 10)); add("energy", -8); msg = "作图与统计推进，显著性开始有了自己的脾气。"; if (gameState.dataQuality < 35 && Math.random() < .25) { add("mood", -10); msg += " 显著性做不出来。"; } }
  if (actionType === "read") { add("literatureUnderstanding", randomInt(8, 14)); add("paperProgress", randomInt(2, 5)); add("mood", -randomInt(1, 4)); add("energy", -6); msg = "你读了文献，并短暂产生了自己会科研的错觉。"; }
  if (actionType === "write") { const bonus = Math.floor((gameState.dataQuality + gameState.literatureUnderstanding) / 45); const base = gameState.dataQuality < 30 ? randomInt(4, 8) : randomInt(8, 16); add("paperProgress", base + bonus); add("energy", -12); add("mood", -randomInt(3, 8)); msg = "你写了论文，摘要像培养基一样反复重配。"; }
  if (actionType === "advisor") { const delta = gameState.experimentProgress < 30 && gameState.dataQuality < 30 ? -randomInt(4, 10) : randomInt(5, 15) + (gameState.dataQuality > 70 ? 4 : 0); add("advisorSatisfaction", delta); add("paperProgress", randomInt(2, 6)); msg = delta > 0 ? "导师听完汇报，决定暂时不皱眉。" : "导师听完汇报，空气开始凝固。"; if (Math.random() < .24) triggerOfficeEvent(); else triggerAdvisorPhrase(delta > 0 ? "encourage" : "critique"); }
  if (actionType === "funding") { add("energy", -6); const ok = Math.random() > .25; add("funding", ok ? randomInt(150, 300) : randomInt(0, 60)); msg = ok ? "报销通过，经费续命。" : "报销材料被退回，财务老师让你补一个不存在的附件。"; }
  if (actionType === "help") { add("mood", randomInt(3, 8)); add("energy", -8); const r = Math.random(); if (r < .25) add("funding", 120); else if (r < .5) gameState.samples++; else if (r < .75) add("literatureUnderstanding", 5); msg = "你帮了同门，获得了科研共同体的微弱温暖。"; }
  if (actionType === "rest") { add("energy", randomInt(20, 35)); add("mood", randomInt(10, 20)); add("graduationPressure", randomInt(3, 6)); msg = "你休息了。身体恢复了，ddl 也更近了。"; if (gameState.flags.restStreak >= 2) triggerAdvisorPhrase("pressure"); }
  if (actionType === "overnight") { if (Math.random() < .5) add("experimentProgress", randomInt(8, 15)); else add("paperProgress", randomInt(8, 15)); add("energy", -20); add("mood", -10); msg = "你熬夜爆肝，咖啡因接管了灵魂。"; if (gameState.energy < 25 && Math.random() < .32) failExperiment("深夜操作失误，实验记录出现神秘空白。"); if (gameState.mood < 20) { gameState.mood = 0; endGame(); } }
  if (gameState.gameOver) return;
  applyTopicDrift();
  updateStage();
  if (gameState.experimentProgress + gameState.dataQuality + gameState.paperProgress <= before + 1) gameState.daysWithoutProgress++; else gameState.daysWithoutProgress = 0;
  addLog(msg);
  checkDaysWithoutProgress();
  nextPeriod();
}
function applyTopicDrift() {
  if (gameState.selectedResearchTopic === "salt_stress") gameState.plantHealth = clampValue(gameState.plantHealth - 1, 0, 100);
  if (gameState.selectedResearchTopic === "drought_stress" && Math.random() < .25) gameState.plantHealth = clampValue(gameState.plantHealth - 3, 0, 100);
  if (gameState.selectedResearchTopic === "nutrient_uptake" && gameState.literatureUnderstanding > 60) gameState.dataQuality = clampValue(gameState.dataQuality + 1, 0, 100);
}
function failExperiment(message) {
  gameState.failedExperiments++;
  gameState.experimentProgress = clampValue(gameState.experimentProgress - randomInt(5, 12), 0, 100);
  gameState.mood = clampValue(gameState.mood - randomInt(6, 14), 0, 100);
  addLog(message);
  triggerAdvisorPhrase("extra");
}
function nextPeriod() {
  const idx = periods.indexOf(gameState.period);
  if (idx < periods.length - 1) gameState.period = periods[idx + 1];
  else nextDay();
  if (!gameState.gameOver) updateUI();
}
function nextDay() {
  triggerRandomEvent();
  checkStageMilestone();
  if (gameState.day >= 30) return endGame();
  gameState.day++;
  gameState.period = periods[0];
  const d = difficulties[gameState.difficulty];
  gameState.graduationPressure = clampValue(gameState.graduationPressure + randomInt(1, 3) * d.pressure, 0, 100);
  updateAdvisorPressure();
  if (Math.random() < .06 * d.advisor + gameState.daysWithoutProgress * .03) triggerOfficeEvent();
}
function triggerRandomEvent() {
  const d = difficulties[gameState.difficulty];
  if (Math.random() > d.event) return;
  const events = [
    ["植物不出苗", () => { gameState.experimentProgress -= 5; gameState.mood -= 5; }],
    ["幼苗徒长", () => { gameState.plantHealth -= 8; gameState.dataQuality -= 3; }],
    ["培养室温度异常", () => { gameState.plantHealth -= randomInt(10, 20); if (gameState.plantHealth < 30) gameState.experimentProgress -= 5; }],
    ["忘记浇水", () => { gameState.plantHealth -= 10; gameState.mood -= 3; }],
    ["浇水过多烂根", () => { gameState.plantHealth -= 15; gameState.dataQuality -= 5; }],
    ["虫害暴发", () => { gameState.plantHealth -= randomInt(12, 25); }],
    ["真菌污染", () => { gameState.experimentProgress -= 8; gameState.dataQuality -= 8; gameState.failedExperiments++; }],
    ["标签掉了，品系混乱", () => { gameState.dataQuality -= randomInt(10, 20); gameState.mood -= 8; }],
    ["取样时间点错过", () => { gameState.dataQuality -= 8; gameState.paperProgress -= 3; }],
    ["胁迫处理过重", () => { gameState.plantHealth -= 20; gameState.dataQuality += 5; if (gameState.plantHealth < 20) gameState.failedExperiments++; }],
    ["RNA 降解", () => { gameState.dataQuality -= 10; gameState.funding -= 80; gameState.failedExperiments++; }],
    ["qPCR 内参不稳定", () => { gameState.dataQuality -= 8; gameState.literatureUnderstanding += 3; }],
    ["试剂盒用完", () => { gameState.funding -= 100; gameState.flags.extraCost = 50; }],
    ["离心机被占用", () => { gameState.flags.blockedAction = "rna"; }],
    ["酶标仪预约失败", () => { gameState.flags.blockedAction = "physiology"; }],
    ["显著性做不出来", () => { gameState.mood -= 10; gameState.dataQuality -= 5; gameState.literatureUnderstanding += 2; }],
    ["结果和预期相反", () => { gameState.mood -= 8; gameState.literatureUnderstanding += 5; if (gameState.literatureUnderstanding > 50) gameState.dataQuality += 5; }],
    ["异常漂亮的数据", () => { gameState.dataQuality += 10; gameState.advisorSatisfaction += 8; gameState.mood += 8; }],
    ["学院通知提交材料", () => { if (gameState.paperProgress < 50) gameState.graduationPressure += 8; }],
    ["论文格式被退回", () => { gameState.paperProgress -= 5; gameState.mood -= 5; }],
    ["盲审专家要求补实验", () => { gameState.experimentProgress -= 5; gameState.graduationPressure += 10; gameState.advisorSatisfaction -= 5; gameState.extraExperimentRequired = true; }],
    ["师兄师姐提醒关键问题", () => { gameState.literatureUnderstanding += 8; gameState.dataQuality += 5; gameState.mood += 5; }]
  ];
  const [name, effect] = events[randomInt(0, events.length - 1)];
  effect();
  normalizeStats();
  $("eventBox").textContent = `随机事件：${name}`;
  addLog(`随机事件：${name}`);
  triggerAdvisorPhrase(Math.random() < .35 ? "guide" : "pressure");
}
function checkStageMilestone() {
  if (gameState.day % 5 !== 0) return;
  const pass = gameState.experimentProgress + gameState.dataQuality + gameState.paperProgress + gameState.advisorSatisfaction > gameState.day * (gameState.difficulty === "hard" ? 7 : 6);
  if (pass) {
    gameState.mood = clampValue(gameState.mood + 5, 0, 100);
    gameState.advisorSatisfaction = clampValue(gameState.advisorSatisfaction + 5, 0, 100);
    addLog(`第 ${gameState.day} 天阶段检查通过，导师暂时把红笔收起来。`);
    triggerAdvisorPhrase("encourage");
  } else {
    gameState.graduationPressure = clampValue(gameState.graduationPressure + 12, 0, 100);
    gameState.advisorSatisfaction = clampValue(gameState.advisorSatisfaction - 8, 0, 100);
    addLog(`第 ${gameState.day} 天阶段检查吃紧，实验室气压下降。`);
    if (Math.random() < .75) triggerOfficeEvent();
  }
}
function updateStage() {
  const p = gameState.experimentProgress, q = gameState.dataQuality, w = gameState.paperProgress;
  let idx = 0;
  if (p >= 10) idx = 1; if (p >= 25) idx = 2; if (gameState.samples > 0) idx = 3; if (p >= 45 && q >= 25) idx = 4;
  if (gameState.flags.rnaDone) idx = 5; if (p >= 70 && q >= 50) idx = 6; if (q >= 65) idx = 7; if (w >= 55) idx = 8; if (w >= 82 && q >= 70) idx = 9;
  gameState.currentStage = stages[idx];
}
function triggerAdvisorPhrase(type) {
  const phrase = getAdvisorPhraseByType(type);
  gameState.lastAdvisorPhrase = phrase;
  if (type === "pressure") { gameState.mood -= randomInt(5, 12); gameState.graduationPressure += randomInt(5, 10); gameState.advisorSatisfaction += gameState.experimentProgress > 55 ? 3 : -5; }
  if (type === "critique") { gameState.mood -= randomInt(6, 15); gameState.paperProgress -= randomInt(2, 6); gameState.dataQuality += randomInt(2, 5); gameState.literatureUnderstanding += randomInt(1, 4); }
  if (type === "guide") { gameState.literatureUnderstanding += randomInt(5, 10); gameState.dataQuality += randomInt(2, 6); gameState.paperProgress += randomInt(2, 5); gameState.mood -= randomInt(2, 5); }
  if (type === "extra") { gameState.graduationPressure += randomInt(6, 12); gameState.funding -= randomInt(50, 120); gameState.extraExperimentRequired = true; }
  if (type === "encourage") { gameState.mood += randomInt(5, 12); gameState.advisorSatisfaction += randomInt(5, 10); gameState.paperProgress += randomInt(2, 6); gameState.literatureUnderstanding += randomInt(2, 5); }
  normalizeStats();
}
function getAdvisorPhraseByType(type) {
  const list = phrasePool[type] || phrasePool.pressure;
  return list[randomInt(0, list.length - 1)];
}
function triggerOfficeEvent() {
  if (!gameState) return;
  gameState.officeEventActive = true;
  gameState.lastAdvisorPhrase = "你来一下我办公室。";
  addLog("导师发来消息：“你来一下我办公室。”");
}
function handleOfficeResponse(responseType) {
  if (!gameState?.officeEventActive) return;
  if (responseType === "data" && gameState.dataQuality > 60) { gameState.advisorSatisfaction += 10; gameState.mood += 4; addLog("你用扎实数据稳住了办公室局面。"); triggerAdvisorPhrase("encourage"); }
  else if (responseType === "plan" && gameState.literatureUnderstanding > 45) { gameState.paperProgress += 6; gameState.advisorSatisfaction += 4; addLog("你的计划让导师决定再给你一周。"); triggerAdvisorPhrase("guide"); }
  else { gameState.mood -= 10; gameState.graduationPressure += 8; gameState.extraExperimentRequired = true; addLog("办公室会谈结束，你带着补实验任务走出门。"); triggerAdvisorPhrase("extra"); }
  gameState.officeEventActive = false;
  normalizeStats();
  updateUI();
}
function updateAdvisorPressure() {
  gameState.advisorPressureLevel = clampValue(Math.ceil((gameState.graduationPressure + (100 - gameState.advisorSatisfaction)) / 45), 1, 5);
}
function checkDaysWithoutProgress() {
  if (gameState.daysWithoutProgress >= 2 && Math.random() < .45) triggerOfficeEvent();
}
function resolveExtraExperiment() {
  if (!gameState.extraExperimentRequired) return;
  gameState.extraExperimentProgress += randomInt(18, 30);
  if (gameState.extraExperimentProgress >= 100) {
    gameState.extraExperimentRequired = false;
    gameState.extraExperimentProgress = 0;
    gameState.dataQuality = clampValue(gameState.dataQuality + 12, 0, 100);
    gameState.advisorSatisfaction = clampValue(gameState.advisorSatisfaction + 8, 0, 100);
    addLog("补实验完成，数据质量明显提升。");
  }
}
function calculateGraduationScore() {
  if (!gameState) return 0;
  let score = gameState.experimentProgress * .22 + gameState.dataQuality * .2 + gameState.paperProgress * .22 + gameState.literatureUnderstanding * .1 + gameState.plantHealth * .08 + gameState.advisorSatisfaction * .13 + gameState.mood * .05;
  score -= gameState.failedExperiments * 2.2;
  score -= Math.max(0, gameState.graduationPressure - 70) * .15;
  if (gameState.extraExperimentRequired) score -= 7;
  return Math.round(clampValue(score, 0, 100));
}
function determineEnding() {
  if (gameState.mood <= 0) return "精神崩溃";
  if (gameState.plantHealth <= 0) return "植物全灭";
  if (gameState.funding <= 0 && gameState.experimentProgress < 75) return "经费枯竭";
  if (gameState.advisorSatisfaction <= 10) return "导师彻底失望";
  const score = calculateGraduationScore();
  if (score >= 90) return "科研新星";
  if (score >= 80) return "优秀毕业";
  if (score >= 65) return "顺利毕业";
  if (score >= 50) return "勉强通过";
  return "延毕";
}
function endGame() {
  gameState.gameOver = true;
  normalizeStats();
  const score = calculateGraduationScore();
  const ending = determineEnding();
  updateLocalBestScore(score);
  unlockEnding(ending);
  addLocalHistory({ score, ending, topic: gameState.selectedResearchTopic, difficulty: gameState.difficulty, createdAt: new Date().toISOString() });
  saveLocalGame(gameState, false);
  openModal("结局判定", `<h3>${ending} · ${score} 分</h3><p>${endingText(ending)}</p>${summaryHtml()}<hr><label>排行榜昵称 <input id="nicknameInput" maxlength="12" placeholder="玩家"></label><div id="turnstileBox" class="cf-turnstile" data-sitekey="${TURNSTILE_SITE_KEY}" data-callback="onTurnstileSuccess"></div><p id="submitStatus"></p><button id="submitScoreBtn" class="primary">提交排行榜</button> <button onclick="startNewGame();document.getElementById('modal').close()">重新开始</button>`);
  setTimeout(renderTurnstile, 50);
  $("submitScoreBtn").onclick = submitFinalScore;
}
function endingText(ending) {
  return {
    "科研新星": "你的图、数据、故事线都站住了，导师甚至转发了你的论文链接。",
    "优秀毕业": "论文顺利过关，植物和你都还活着，这已经很不容易。",
    "顺利毕业": "你踩着截止线完成了答辩，实验记录本终于合上。",
    "勉强通过": "有惊无险，毕业了，但你的文件夹命名仍然需要心理疏导。",
    "延毕": "毕业系统不会等你，但马铃薯还在等下一轮培养。",
    "精神崩溃": "你的心态归零，建议先睡觉，再谈科研。",
    "植物全灭": "植物沉默了，实验室也沉默了。",
    "经费枯竭": "经费用完，连移液枪枪头都显得珍贵。",
    "导师彻底失望": "导师的沉默比批注更响。"
  }[ending] || "这一天终于结束了。";
}
function summaryHtml() {
  const stats = ["energy","mood","plantHealth","experimentProgress","dataQuality","literatureUnderstanding","paperProgress","advisorSatisfaction"];
  return `<div class="card-grid compact">${stats.map((k) => `<div class="choice-card"><strong>${statLabel(k)}</strong><small>${Math.round(gameState[k])}</small></div>`).join("")}</div>`;
}
function normalizeStats() {
  ["energy","mood","plantHealth","experimentProgress","dataQuality","literatureUnderstanding","paperProgress","advisorSatisfaction","graduationPressure"].forEach((k) => gameState[k] = clampValue(Math.round(gameState[k]), 0, 100));
  gameState.funding = Math.max(0, Math.round(gameState.funding));
}
function updateUI() {
  if (!gameState) return;
  normalizeStats();
  $("dayPeriod").textContent = `Day ${gameState.day} · ${gameState.period} · 压力 ${gameState.graduationPressure}`;
  $("stageName").textContent = gameState.currentStage;
  $("topicName").textContent = topics[gameState.selectedResearchTopic][0];
  $("difficultyName").textContent = difficulties[gameState.difficulty].name;
  $("advisorLine").textContent = `导师：${gameState.lastAdvisorPhrase}`;
  $("officeEvent").classList.toggle("hidden", !gameState.officeEventActive);
  const stats = ["energy","mood","plantHealth","experimentProgress","dataQuality","literatureUnderstanding","paperProgress","advisorSatisfaction","graduationPressure","funding"];
  $("statsList").innerHTML = stats.map((k) => `<div class="stat"><div class="stat-row"><span>${statLabel(k)}</span><strong>${Math.round(gameState[k])}${k === "funding" ? "" : "/100"}</strong></div><div class="bar ${k === "funding" ? "money" : ""}"><i style="width:${k === "funding" ? clampValue(gameState[k] / 15, 0, 100) : gameState[k]}%"></i></div></div>`).join("");
  $("actionsGrid").innerHTML = actions.map(([key, name, tip]) => {
    const reason = canDo(key);
    return `<button class="action-btn" data-game-action="${key}" ${reason ? "disabled" : ""}>${name}<small>${reason || tip}</small></button>`;
  }).join("");
  $("logList").innerHTML = gameState.logs.slice(0, 15).map((log) => `<li>${escapeHtml(log)}</li>`).join("");
}
function statLabel(key) {
  return { energy:"⚡ 精力", mood:"😵 心态", plantHealth:"🌱 植物健康", experimentProgress:"🧪 实验进度", dataQuality:"📊 数据质量", literatureUnderstanding:"📚 文献理解", paperProgress:"📝 论文进度", advisorSatisfaction:"👨‍🏫 导师满意度", graduationPressure:"毕业压力", funding:"经费" }[key] || key;
}
function addLog(message) {
  if (!gameState) return;
  gameState.logs.unshift(`Day ${gameState.day} ${gameState.period}：${message}`);
  gameState.logs = gameState.logs.slice(0, 80);
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (m) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
}

function getOrCreateGuestId() {
  let id = localStorage.getItem("graduate_game_guest_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem("graduate_game_guest_id", id);
  }
  return id;
}
function readLocalBundle() {
  return {
    guestId: getOrCreateGuestId(),
    nickname: localStorage.getItem("graduate_game_nickname") || "",
    settings: JSON.parse(localStorage.getItem("graduate_game_settings") || '{"music":true,"sound":true,"theme":"lab"}'),
    bestScore: Number(localStorage.getItem("graduate_game_best_score") || 0),
    unlockedEndings: JSON.parse(localStorage.getItem("graduate_game_unlocked_endings") || "[]"),
    lastSave: loadLocalSave(),
    history: JSON.parse(localStorage.getItem("graduate_game_history") || "[]")
  };
}
function loadLocalSave() {
  try { return JSON.parse(localStorage.getItem("graduate_game_save") || "null"); } catch { return null; }
}
function saveLocalGame(state, notify = true) {
  if (!state) return showToast("当前没有可保存的进度。");
  localStorage.setItem("graduate_game_save", JSON.stringify({ guestId: getOrCreateGuestId(), day: state.day, period: state.period, gameState: state, savedAt: new Date().toISOString() }));
  if (notify) showToast("进度已保存到本设备。");
}
function clearLocalSave() {
  localStorage.removeItem("graduate_game_save");
  showToast("本地存档已清除。");
}
function updateLocalBestScore(score) {
  const best = Number(localStorage.getItem("graduate_game_best_score") || 0);
  if (score > best) localStorage.setItem("graduate_game_best_score", String(score));
}
function unlockEnding(ending) {
  const list = JSON.parse(localStorage.getItem("graduate_game_unlocked_endings") || "[]");
  if (!list.includes(ending)) list.push(ending);
  localStorage.setItem("graduate_game_unlocked_endings", JSON.stringify(list));
}
function addLocalHistory(record) {
  const history = JSON.parse(localStorage.getItem("graduate_game_history") || "[]");
  history.unshift(record);
  localStorage.setItem("graduate_game_history", JSON.stringify(history.slice(0, 30)));
}
function exportLocalSave() {
  const blob = new Blob([JSON.stringify(readLocalBundle(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `graduate-game-save-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function importLocalSave(json) {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object" || !data.guestId) throw new Error("bad");
    if (data.lastSave?.gameState) localStorage.setItem("graduate_game_save", JSON.stringify(data.lastSave));
    if (Array.isArray(data.unlockedEndings)) localStorage.setItem("graduate_game_unlocked_endings", JSON.stringify(data.unlockedEndings));
    if (Array.isArray(data.history)) localStorage.setItem("graduate_game_history", JSON.stringify(data.history.slice(0, 30)));
    if (typeof data.bestScore === "number") localStorage.setItem("graduate_game_best_score", String(data.bestScore));
    showToast("存档导入成功。");
  } catch {
    showToast("导入失败：存档格式不正确。");
  }
}

async function apiFetch(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({ ok: false, error: "响应格式异常" }));
    if (!response.ok || data.ok === false) throw new Error(data.error || "请求失败");
    return data;
  } catch (error) {
    showToast(error.message || "网络请求失败");
    return { ok: false, error: error.message || "网络请求失败" };
  }
}
function apiGetLeaderboard(filters = {}) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  return apiFetch(`/api/leaderboard?${qs}`);
}
function apiSubmitScore(payload) { return apiFetch("/api/leaderboard", { method: "POST", body: JSON.stringify(payload) }); }
function apiHealthCheck() { return apiFetch("/api/health"); }
function apiSendLoginCode(email, turnstileToken) { return apiFetch("/api/auth/send-code", { method: "POST", body: JSON.stringify({ email, turnstileToken }) }); }
function apiVerifyLoginCode(email, code) { return apiFetch("/api/auth/verify-code", { method: "POST", body: JSON.stringify({ email, code }) }); }
function apiGetMe() { return apiFetch("/api/me"); }
function apiLogout() { return apiFetch("/api/auth/logout", { method: "POST", body: "{}" }); }
function apiGetCloudSave() { return apiFetch("/api/save"); }
function apiUploadCloudSave(saveData) { return apiFetch("/api/save", { method: "POST", body: JSON.stringify({ saveData }) }); }

function renderTurnstile() {
  if (window.turnstile && $("turnstileBox")) {
    try { window.turnstile.render("#turnstileBox", { sitekey: TURNSTILE_SITE_KEY, callback: (token) => { turnstileToken = token; } }); } catch {}
  }
}
window.onTurnstileSuccess = (token) => { turnstileToken = token; };
async function submitFinalScore() {
  const nickname = ($("nicknameInput")?.value || "玩家").trim();
  const score = calculateGraduationScore();
  const ending = determineEnding();
  $("submitStatus").textContent = "提交中...";
  const payload = {
    guestId: getOrCreateGuestId(), nickname, score, ending,
    topic: gameState.selectedResearchTopic, difficulty: gameState.difficulty,
    gameSummary: { day: gameState.day, actionsCount: gameState.actionsCount, finalStats: {
      energy: gameState.energy, mood: gameState.mood, plantHealth: gameState.plantHealth,
      experimentProgress: gameState.experimentProgress, dataQuality: gameState.dataQuality,
      literatureUnderstanding: gameState.literatureUnderstanding, paperProgress: gameState.paperProgress,
      advisorSatisfaction: gameState.advisorSatisfaction
    }, failedExperiments: gameState.failedExperiments },
    turnstileToken
  };
  const result = await apiSubmitScore(payload);
  $("submitStatus").textContent = result.ok ? "排行榜提交成功。" : `提交失败：${result.error || "请稍后再试"}`;
}
async function showLeaderboard() {
  openModal("排行榜", `<div class="stage-row"><select id="lbDifficulty"><option value="">全部难度</option><option value="easy">摸鱼模式</option><option value="normal">普通模式</option><option value="hard">地狱模式</option></select><select id="lbTopic"><option value="">全部方向</option>${Object.entries(topics).map(([k,v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select><button id="reloadLb">刷新</button></div><div id="lbBox">加载中...</div>`);
  const load = async () => {
    const data = await apiGetLeaderboard({ difficulty: $("lbDifficulty").value, topic: $("lbTopic").value });
    $("lbBox").innerHTML = data.ok && data.items?.length ? `<table class="leaderboard-table"><thead><tr><th>#</th><th>昵称</th><th>分数</th><th>结局</th><th>方向</th><th>难度</th><th>时间</th></tr></thead><tbody>${data.items.map((it) => `<tr><td>${it.rank}</td><td>${escapeHtml(it.nickname)}</td><td>${it.score}</td><td>${it.ending}</td><td>${topics[it.topic]?.[0] || it.topic}</td><td>${difficulties[it.difficulty]?.name || it.difficulty}</td><td>${new Date(it.createdAt).toLocaleDateString()}</td></tr>`).join("")}</tbody></table>` : "暂无排行数据。";
  };
  $("reloadLb").onclick = load;
  $("lbDifficulty").onchange = load;
  $("lbTopic").onchange = load;
  load();
}
function showSaveModal() {
  const bundle = readLocalBundle();
  openModal("本地存档", `<p>游客模式：存档仅保存在本设备。登录后可开启云端存档。</p><p>最佳分数：${bundle.bestScore}</p><p>已解锁结局：${bundle.unlockedEndings.join("、") || "暂无"}</p><button onclick="saveLocalGame(gameState)">保存进度</button> <button onclick="continueGame();document.getElementById('modal').close()">继续游戏</button> <button onclick="clearLocalSave()">清除存档</button> <button onclick="exportLocalSave()">导出存档</button>`);
}
function showSettings() {
  openModal("设置", `<p>当前版本提供轻量设置预留。本地设置 key：graduate_game_settings。</p><button onclick="localStorage.setItem('graduate_game_settings', JSON.stringify({music:true,sound:true,theme:'lab'}));showToast('设置已保存')">使用实验室主题</button>`);
}
function showAbout() {
  openModal("关于游戏", `<p>这是一款以植物方向研究生生活为主题的时间管理与策略游戏。玩家需要在有限时间内照顾植物、推进实验、应对导师、整理数据、撰写论文，并争取顺利毕业。</p><p><strong>温馨提示：</strong>本游戏含有大量研究生真实体验，如感到熟悉，说明你并不孤单。</p><p><strong>社群信息：</strong>欢迎加入游戏交流群：123855019</p>`);
}
function showLoginModal() {
  openModal("登录", `<p>账号系统开发中，当前版本支持游客模式和本地存档。后端已预留邮箱验证码登录接口。</p><label>邮箱 <input id="emailInput" maxlength="80" placeholder="user@example.com"></label><button id="sendCodeBtn">发送验证码</button><br><label>验证码 <input id="codeInput" maxlength="6" placeholder="123456"></label><button id="verifyCodeBtn">登录</button><p id="loginStatus"></p>`);
  $("sendCodeBtn").onclick = async () => {
    const r = await apiSendLoginCode($("emailInput").value.trim(), turnstileToken);
    $("loginStatus").textContent = r.ok ? `验证码已发送${r.devCode ? `：${r.devCode}` : ""}` : r.error;
  };
  $("verifyCodeBtn").onclick = async () => {
    const r = await apiVerifyLoginCode($("emailInput").value.trim(), $("codeInput").value.trim());
    $("loginStatus").textContent = r.ok ? "登录成功。" : r.error;
  };
}

window.addEventListener("DOMContentLoaded", initGame);
