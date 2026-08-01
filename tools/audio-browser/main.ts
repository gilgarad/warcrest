import {
  BGM_ASSETS,
  SFX_ASSETS,
  getAudioSystem,
  type BgmAssetDef,
  type SfxAssetDef,
} from "../../src/systems/audio";

type BrowserAsset =
  | { kind: "bgm"; asset: BgmAssetDef }
  | { kind: "sfx"; asset: SfxAssetDef };

interface TreeNode {
  name: string;
  path: string;
  dirs: Map<string, TreeNode>;
  files: BrowserAsset[];
}

const audio = getAudioSystem();
void audio.initialize();

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const unlockBtn = $<HTMLButtonElement>("unlockBtn");
const stopBgmBtn = $<HTMLButtonElement>("stopBgmBtn");
const stopAllSfxBtn = $<HTMLButtonElement>("stopAllSfxBtn");
const muteBtn = $<HTMLButtonElement>("muteBtn");
const playSelectedBtn = $<HTMLButtonElement>("playSelectedBtn");
const downloadInfoBtn = $<HTMLButtonElement>("downloadInfoBtn");
const unlockStatus = $<HTMLDivElement>("unlockStatus");
const treeEl = $<HTMLDivElement>("tree");
const selectedPathEl = $<HTMLDivElement>("selectedPath");
const selectedLabelEl = $<HTMLDivElement>("selectedLabel");
const selectedTypeEl = $<HTMLDivElement>("selectedType");
const selectedCategoryEl = $<HTMLDivElement>("selectedCategory");
const selectedSynthEl = $<HTMLDivElement>("selectedSynth");
const selectedModeEl = $<HTMLDivElement>("selectedMode");
const eventLogEl = $<HTMLPreElement>("eventLog");

const allAssets: BrowserAsset[] = [
  ...BGM_ASSETS.map((asset) => ({ kind: "bgm" as const, asset })),
  ...SFX_ASSETS.map((asset) => ({ kind: "sfx" as const, asset })),
];

let selectedAsset: BrowserAsset | null = null;
let muted = false;
const eventLog: string[] = [];

function appendLog(line: string): void {
  eventLog.unshift(`[${new Date().toLocaleTimeString("ko-KR", { hour12: false })}] ${line}`);
  eventLog.splice(20);
  eventLogEl.textContent = eventLog.join("\n");
}

function makeRoot(): TreeNode {
  return { name: "root", path: "", dirs: new Map(), files: [] };
}

function assetPath(asset: BrowserAsset): string {
  return asset.asset.filePath.replace(/^\/+/, "");
}

function getNode(root: TreeNode, segments: string[]): TreeNode {
  let node = root;
  let currentPath = "";
  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    let next = node.dirs.get(segment);
    if (!next) {
      next = { name: segment, path: currentPath, dirs: new Map(), files: [] };
      node.dirs.set(segment, next);
    }
    node = next;
  }
  return node;
}

function buildTree(): TreeNode {
  const root = makeRoot();
  for (const item of allAssets) {
    const parts = assetPath(item).split("/");
    const fileName = parts.pop();
    if (!fileName) continue;
    const node = getNode(root, parts);
    node.files.push(item);
  }
  return root;
}

function describeAsset(asset: BrowserAsset): {
  type: string;
  category: string;
  synth: string;
  mode: string;
} {
  if (asset.kind === "bgm") {
    return {
      type: "BGM",
      category: asset.asset.loop ? "loop" : "one-shot",
      synth: `${asset.asset.synth.kind} @ ${asset.asset.synth.frequency}Hz`,
      mode: asset.asset.missingAsset ? "합성 fallback" : "실파일",
    };
  }
  return {
    type: "SFX",
    category: asset.asset.category,
    synth: `${asset.asset.synth.kind} @ ${asset.asset.synth.frequency}Hz`,
    mode: asset.asset.missingAsset ? "합성 fallback" : "실파일",
  };
}

function selectAsset(asset: BrowserAsset): void {
  selectedAsset = asset;
  const path = assetPath(asset);
  const info = describeAsset(asset);
  selectedPathEl.textContent = path;
  selectedLabelEl.textContent = asset.asset.label;
  selectedTypeEl.textContent = info.type;
  selectedCategoryEl.textContent = info.category;
  selectedSynthEl.textContent = info.synth;
  selectedModeEl.textContent = info.mode;
}

function playAsset(asset: BrowserAsset): void {
  selectAsset(asset);
  const path = assetPath(asset);
  if (asset.kind === "bgm") {
    audio.playBgm(asset.asset.id);
    appendLog(`BGM 재생: ${path}`);
    return;
  }
  const result = audio.playSfx(asset.asset.id, { eventKey: `browser:${asset.asset.id}:${performance.now()}` });
  appendLog(`SFX 재생: ${path} -> ${result}`);
}

function renderFile(asset: BrowserAsset): HTMLElement {
  const row = document.createElement("div");
  row.className = "file";

  const labelWrap = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.className = "file-name";
  nameEl.textContent = assetPath(asset).split("/").pop() ?? asset.asset.id;
  const metaEl = document.createElement("div");
  metaEl.className = "file-meta";
  metaEl.textContent = `${asset.asset.label} · ${asset.kind === "bgm" ? "BGM" : asset.asset.category}`;
  labelWrap.append(nameEl, metaEl);

  const actions = document.createElement("div");
  actions.className = "file-actions";

  const selectBtn = document.createElement("button");
  selectBtn.textContent = "선택";
  selectBtn.addEventListener("click", () => selectAsset(asset));

  const playBtn = document.createElement("button");
  playBtn.className = "primary";
  playBtn.textContent = "재생";
  playBtn.addEventListener("click", () => playAsset(asset));

  actions.append(selectBtn, playBtn);
  row.append(labelWrap, actions);
  return row;
}

function renderNode(node: TreeNode): HTMLElement {
  const details = document.createElement("details");
  details.open = node.path.split("/").length < 3;

  const summary = document.createElement("summary");
  const label = document.createElement("span");
  label.className = "dir-label";
  label.textContent = node.name;
  summary.append(label);
  details.append(summary);

  const content = document.createElement("div");

  const childDirs = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
  childDirs.forEach((child) => content.append(renderNode(child)));

  if (node.files.length > 0) {
    const fileList = document.createElement("div");
    fileList.className = "file-list";
    node.files
      .slice()
      .sort((a, b) => assetPath(a).localeCompare(assetPath(b)))
      .forEach((file) => fileList.append(renderFile(file)));
    content.append(fileList);
  }

  details.append(content);
  return details;
}

function renderTree(): void {
  const root = buildTree();
  treeEl.replaceChildren();
  [...root.dirs.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((child) => treeEl.append(renderNode(child)));
}

unlockBtn.addEventListener("click", () => {
  void audio.unlock().then(() => {
    unlockStatus.textContent = audio.getState().unlocked
      ? "오디오 활성화 완료. 이제 파일 항목을 눌러 들을 수 있습니다."
      : "오디오 활성화 실패";
    appendLog("오디오 활성화");
  });
});

stopBgmBtn.addEventListener("click", () => {
  audio.stopBgm();
  appendLog("BGM 정지");
});

stopAllSfxBtn.addEventListener("click", () => {
  audio.stopAllSfx();
  appendLog("SFX 정지");
});

muteBtn.addEventListener("click", () => {
  muted = !muted;
  audio.setMuted(muted);
  appendLog(`음소거 ${muted ? "ON" : "OFF"}`);
});

playSelectedBtn.addEventListener("click", () => {
  if (!selectedAsset) {
    appendLog("선택된 항목 없음");
    return;
  }
  playAsset(selectedAsset);
});

downloadInfoBtn.addEventListener("click", () => {
  appendLog("실파일 다운로드는 아직 불가: 현재는 manifest 경로 + 합성 fallback 구조");
});

renderTree();
const firstCombat = allAssets.find((asset) => asset.kind === "sfx" && asset.asset.id === "sfx.combat.slashAttack");
if (firstCombat) selectAsset(firstCombat);
