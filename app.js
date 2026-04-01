const state = {
  config: null,
  assignments: [],
  engines: [],
  audioReady: false,
  audio: null
};

const toolsConfig = [
  { id: "drum_neon", name: "霓虹鼓轮", category: "beat", color: "#ffab4c", pattern: [120, 240, 360], pitch: 90 },
  { id: "drum_glitch", name: "碎拍鼓箱", category: "beat", color: "#ff7f66", pattern: [0, 180, 460], pitch: 125 },
  { id: "bass_void", name: "深空贝斯", category: "bass", color: "#9a5bff", pattern: [0, 320], pitch: 55 },
  { id: "melody_blink", name: "闪光旋律", category: "melody", color: "#43ffe4", pattern: [0, 180, 360, 540], pitch: 330 },
  { id: "atmo_mist", name: "薄雾氛围", category: "ambient", color: "#6eb8ff", pattern: [0], pitch: 220 },
  { id: "vocal_yo", name: "YO 人声", category: "vocal", color: "#ff6d94", pattern: [0, 380], pitch: 260 }
];

const comboRules = [
  {
    id: "starter",
    categories: ["beat", "bass", "melody"],
    message: "组合完成：鼓点 + 贝斯 + 旋律"
  }
];

const entry = document.querySelector("#entry");
const stageView = document.querySelector("#stageView");
const startBtn = document.querySelector("#startBtn");
const stageEl = document.querySelector("#stage");
const rackEl = document.querySelector("#toolRack");
const bonusBanner = document.querySelector("#bonusBanner");
const resetBtn = document.querySelector("#resetBtn");
const saveBtn = document.querySelector("#saveBtn");
const appTitleEl = document.querySelector("#appTitle");
const entryDescEl = document.querySelector("#entryDesc");
const stageTitleEl = document.querySelector("#stageTitle");
const toolPanelTitleEl = document.querySelector("#toolPanelTitle");

const idleAnimationClassMap = {
  head_bob_slow: "idle-head-bob-slow",
  foot_tap_alt: "idle-foot-tap-alt",
  shoulder_breath_small: "idle-shoulder-breath-small",
  body_sway_lr_small: "idle-body-sway-lr-small",
  finger_twitch: "idle-finger-twitch",
  head_nod_micro: "idle-head-nod-micro",
  float_up_down: "idle-float-up-down",
  blink_slow: "idle-blink-slow",
  breathe_soft: "idle-breathe-soft",
  head_snap_small: "idle-head-snap-small",
  hold_frame_short: "idle-hold-frame-short",
  twitch_once: "idle-twitch-once",
  shoulder_sway: "idle-shoulder-sway",
  hand_face_touch: "idle-hand-face-touch",
  head_tilt_soft: "idle-head-tilt-soft",
  bounce_small: "idle-bounce-small",
  eye_glance_side: "idle-eye-glance-side",
  quick_blink: "idle-quick-blink",
  weight_shift_slow: "idle-weight-shift-slow",
  shoulder_breath: "idle-shoulder-breath",
  slow_head_raise: "idle-slow-head-raise"
};

init();

async function init() {
  state.config = await loadConfig();
  state.assignments = Array(state.config.stageOrder.length).fill(null);
  state.engines = Array(state.config.stageOrder.length).fill(null);

  applyUiCopy();
  renderPerformers();
  renderRack();
}

async function loadConfig() {
  const res = await fetch("./data/characters.json");
  if (!res.ok) throw new Error("角色配置读取失败");
  return res.json();
}

function applyUiCopy() {
  const { packNameCn, uiCopyCn } = state.config;
  appTitleEl.textContent = packNameCn;
  entryDescEl.textContent = "拖拽声音道具，组建你的原创角色演出。";
  stageTitleEl.textContent = "夜色主舞台";
  toolPanelTitleEl.textContent = "选择声音包";

  startBtn.textContent = uiCopyCn.start;
  resetBtn.textContent = uiCopyCn.reset;
  saveBtn.textContent = uiCopyCn.save;
  bonusBanner.textContent = uiCopyCn.dragHint;
}

startBtn.addEventListener("click", async () => {
  await ensureAudio();
  entry.classList.add("hidden");
  stageView.classList.remove("hidden");
});

saveBtn.addEventListener("click", () => {
  bonusBanner.textContent = "已记录当前混搭（原型占位）";
});

resetBtn.addEventListener("click", () => {
  state.assignments.forEach((_, idx) => clearPerformer(idx));
  bonusBanner.textContent = state.config.uiCopyCn.dragHint;
  bonusBanner.className = "bonus-banner";
});

function ensureAudio() {
  if (state.audioReady) return Promise.resolve();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  state.audio = new Ctx();
  state.audioReady = true;
  return state.audio.resume();
}

function createLoopEngine(tool) {
  const ctx = state.audio;
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(ctx.destination);

  let timer = null;
  const interval = 720;

  const triggerTone = (offsetMs = 0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime + offsetMs / 1000;

    osc.type = tool.category === "beat" ? "square" : tool.category === "bass" ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(tool.pitch, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.26);
  };

  const tick = () => {
    tool.pattern.forEach((offset) => triggerTone(offset));
  };

  return {
    start() {
      tick();
      timer = setInterval(tick, interval);
      output.gain.cancelScheduledValues(ctx.currentTime);
      output.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.16);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      output.gain.cancelScheduledValues(ctx.currentTime);
      output.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      setTimeout(() => output.disconnect(), 280);
    }
  };
}

function renderPerformers() {
  const tpl = document.querySelector("#performerTemplate");
  const characterMap = new Map(state.config.characters.map((char) => [char.id, char]));

  state.config.stageOrder.forEach((charId, index) => {
    const character = characterMap.get(charId);
    if (!character) return;

    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.index = index;
    node.dataset.characterId = character.id;
    node.style.setProperty("--char-scale", character.scale);
    node.querySelector(".performer-name").textContent = character.nameCn;
    node.querySelector(".performer-gear").textContent = character.defaultState.mood;

    setIdleAnimationClasses(node, character.idleAnimations);

    node.addEventListener("dragover", (e) => {
      e.preventDefault();
      node.classList.add("drag-over");
    });
    node.addEventListener("dragleave", () => node.classList.remove("drag-over"));
    node.addEventListener("drop", async (e) => {
      e.preventDefault();
      node.classList.remove("drag-over");
      const id = e.dataTransfer.getData("tool-id");
      const tool = toolsConfig.find((item) => item.id === id);
      if (!tool) return;
      await ensureAudio();
      applyTool(index, tool, node);
    });

    node.querySelector(".remove-chip").addEventListener("click", () => clearPerformer(index));
    stageEl.appendChild(node);
  });
}

function setIdleAnimationClasses(node, idleAnimations) {
  idleAnimations
    .map((name) => idleAnimationClassMap[name])
    .filter(Boolean)
    .forEach((className) => node.classList.add(className));
}

function renderRack() {
  const categoryNameMap = new Map(state.config.categories.map((cat) => [cat.id, cat.nameCn]));

  toolsConfig.forEach((tool) => {
    const el = document.createElement("button");
    el.type = "button";
    el.draggable = true;
    el.className = "tool";
    el.innerHTML = `<div class="cat">${categoryNameMap.get(tool.category) ?? tool.category}</div><div class="name">${tool.name}</div>`;
    el.style.boxShadow = `inset 0 0 0 1px ${tool.color}66`;

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("tool-id", tool.id);
      bonusBanner.textContent = state.config.uiCopyCn.dragHint;
    });

    rackEl.appendChild(el);
  });
}

function applyTool(index, tool, performerEl) {
  clearPerformer(index, true);

  state.assignments[index] = tool;
  const gear = performerEl.querySelector(".performer-gear");
  gear.textContent = `${findCategoryName(tool.category)} · ${tool.name}`;
  gear.style.color = tool.color;
  performerEl.dataset.empty = "false";
  performerEl.classList.add("active");

  const avatar = performerEl.querySelector(".avatar");
  avatar.style.color = tool.color;

  const engine = createLoopEngine(tool);
  state.engines[index] = engine;
  engine.start();

  updateStageFeedback();
}

function clearPerformer(index, silent = false) {
  const performerEl = stageEl.querySelector(`[data-index="${index}"]`);
  const oldEngine = state.engines[index];
  if (oldEngine) oldEngine.stop();

  state.assignments[index] = null;
  state.engines[index] = null;

  if (!performerEl) return;
  const charId = performerEl.dataset.characterId;
  const charConfig = state.config.characters.find((char) => char.id === charId);

  performerEl.dataset.empty = "true";
  performerEl.classList.remove("active", "drag-over");
  performerEl.querySelector(".performer-gear").textContent = charConfig?.defaultState.mood || "待机";
  performerEl.querySelector(".performer-gear").style.color = "";
  performerEl.querySelector(".avatar").style.color = "";

  if (!silent) updateStageFeedback();
}

function updateStageFeedback() {
  const activeTools = state.assignments.filter(Boolean);
  const activeCount = activeTools.length;
  const catSet = new Set(activeTools.map((t) => t.category));

  stageEl.classList.toggle("energized", activeCount >= 4);
  bonusBanner.className = "bonus-banner";

  const combo = comboRules.find((rule) => rule.categories.every((cat) => catSet.has(cat)));
  if (activeCount === state.assignments.length) {
    bonusBanner.textContent = `${state.config.uiCopyCn.fullCast}！舞台进入高亮模式`;
    bonusBanner.classList.add("full");
  } else if (combo) {
    bonusBanner.textContent = `${state.config.uiCopyCn.comboDone}：${combo.message.replace("组合完成：", "")}`;
    bonusBanner.classList.add("combo");
  } else if (activeCount === 0) {
    bonusBanner.textContent = state.config.uiCopyCn.dragHint;
  } else {
    bonusBanner.textContent = `已激活 ${activeCount} / ${state.assignments.length}`;
  }
}

function findCategoryName(categoryId) {
  return state.config.categories.find((cat) => cat.id === categoryId)?.nameCn || categoryId;
}
