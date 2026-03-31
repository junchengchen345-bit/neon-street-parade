const performersConfig = [
  "星火狸", "泡泡蛙", "电音鹭", "喵喵雷", "雾团狐", "糖闪鲸", "夜巡犬"
];

const toolsConfig = [
  { id: "drum_neon", name: "霓虹鼓轮", category: "鼓点", color: "#ffab4c", pattern: [120, 240, 360], pitch: 90 },
  { id: "drum_glitch", name: "碎拍鼓箱", category: "鼓点", color: "#ff7f66", pattern: [0, 180, 460], pitch: 125 },
  { id: "bass_void", name: "深空贝斯", category: "贝斯", color: "#9a5bff", pattern: [0, 320], pitch: 55 },
  { id: "melody_blink", name: "闪光旋律", category: "旋律", color: "#43ffe4", pattern: [0, 180, 360, 540], pitch: 330 },
  { id: "atmo_mist", name: "薄雾氛围", category: "氛围", color: "#6eb8ff", pattern: [0], pitch: 220 },
  { id: "vocal_yo", name: "YO 人声", category: "人声", color: "#ff6d94", pattern: [0, 380], pitch: 260 }
];

const comboRules = [
  {
    id: "starter",
    categories: ["鼓点", "贝斯", "旋律"],
    message: "组合完成：鼓点 + 贝斯 + 旋律"
  }
];

const state = {
  assignments: Array(7).fill(null),
  engines: Array(7).fill(null),
  audioReady: false,
  audio: null
};

const entry = document.querySelector("#entry");
const stageView = document.querySelector("#stageView");
const startBtn = document.querySelector("#startBtn");
const stageEl = document.querySelector("#stage");
const rackEl = document.querySelector("#toolRack");
const bonusBanner = document.querySelector("#bonusBanner");
const resetBtn = document.querySelector("#resetBtn");

startBtn.addEventListener("click", async () => {
  await ensureAudio();
  entry.classList.add("hidden");
  stageView.classList.remove("hidden");
});

document.querySelector("#saveBtn").addEventListener("click", () => {
  bonusBanner.textContent = "已记录当前混搭（原型占位）";
});

resetBtn.addEventListener("click", () => {
  state.assignments.forEach((_, idx) => clearPerformer(idx));
  bonusBanner.textContent = "重新来一遍，拖到角色身上";
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

    osc.type = tool.category === "鼓点" ? "square" : tool.category === "贝斯" ? "sawtooth" : "triangle";
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
  performersConfig.forEach((name, index) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.index = index;
    node.classList.add(`variant-${index}`);
    node.querySelector(".performer-name").textContent = name;

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

function renderRack() {
  toolsConfig.forEach((tool) => {
    const el = document.createElement("button");
    el.type = "button";
    el.draggable = true;
    el.className = "tool";
    el.innerHTML = `<div class="cat">${tool.category}</div><div class="name">${tool.name}</div>`;
    el.style.boxShadow = `inset 0 0 0 1px ${tool.color}66`;

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("tool-id", tool.id);
      bonusBanner.textContent = "拖到角色身上";
    });

    rackEl.appendChild(el);
  });
}

function applyTool(index, tool, performerEl) {
  clearPerformer(index, true);

  state.assignments[index] = tool;
  const gear = performerEl.querySelector(".performer-gear");
  gear.textContent = `${tool.category} · ${tool.name}`;
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
  performerEl.dataset.empty = "true";
  performerEl.classList.remove("active", "drag-over");
  performerEl.querySelector(".performer-gear").textContent = "待机";
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
  if (activeCount === 7) {
    bonusBanner.textContent = "满编演出！舞台进入高亮模式";
    bonusBanner.classList.add("full");
  } else if (combo) {
    bonusBanner.textContent = combo.message;
    bonusBanner.classList.add("combo");
  } else if (activeCount === 0) {
    bonusBanner.textContent = "拖到角色身上";
  } else {
    bonusBanner.textContent = `已激活 ${activeCount} / 7`; 
  }
}

renderPerformers();
renderRack();
