import { KINDS, isPreviewable } from "./classify";
import type { AssetRecord } from "./record";
import type { AssetRules } from "./rules";
import { CHANGES } from "./snapshot";
import { USAGES } from "./usage";

/** JSON that is safe inside a <script> element. */
const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c");

const STYLE = `
:root { color-scheme: dark; --bg: #0b1a20; --surface: #10222a; --surface-2: #1c2b31; --border: #2c3b42;
  --border-strong: #3d5058; --text: #e8e2d8; --muted: #8fa3aa; --accent: #ff7e2f; --link: #8fd6e0; --ink: #05090b;
  --u-published: #8fd6e0; --u-site-ui: #b9d98f; --u-unpublished: #e0c27a; --u-unused: #5f727a; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.6 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif; }
button { font: inherit; color: var(--text); background: var(--surface-2); border: 2px solid var(--border); padding: 2px 10px; cursor: pointer; }
button:hover { border-color: var(--border-strong); }
button:active { transform: translateY(1px); }
button[aria-pressed="true"] { border-color: var(--link); color: var(--link); }
button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
a { color: var(--link); }
.layout { display: grid; grid-template-columns: 1fr; min-height: 100dvh; }
.sidebar { background: var(--surface); border-bottom: 2px solid var(--border); padding: 16px; }
.sidebar h1 { font-size: 18px; margin: 0 0 4px; }
.sidebar .meta { color: var(--muted); font-size: 12px; margin: 0 0 12px; }
.tree-wrap summary { cursor: pointer; color: var(--muted); font-size: 12px; margin-bottom: 8px; }
.tree { list-style: none; margin: 0; padding: 0; }
.tree button { width: 100%; display: flex; justify-content: space-between; gap: 8px; text-align: left; border: 0; border-left: 3px solid transparent; background: none; padding: 3px 8px; }
.tree button:hover { background: var(--surface-2); }
.tree button[aria-current="true"] { border-left-color: var(--link); background: var(--surface-2); color: var(--link); }
.tree .n { color: var(--muted); font-variant-numeric: tabular-nums; }
.tree ul { list-style: none; margin: 0 0 6px; padding: 0 0 0 12px; }
.tree .group > button { font-weight: 700; margin-top: 6px; }
.main { padding: 16px; min-width: 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 16px; background: var(--bg); padding: 8px 0; border-bottom: 1px solid var(--border); }
.toolbar input { font: inherit; color: var(--text); background: var(--surface); border: 2px solid var(--border); padding: 4px 10px; flex: 1 1 240px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips .label { color: var(--muted); font-size: 12px; align-self: center; }
.count { color: var(--muted); font-variant-numeric: tabular-nums; }
.dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; background: var(--u); }
.section-title { display: flex; align-items: baseline; gap: 10px; margin: 24px 0 10px; padding-bottom: 4px; border-bottom: 1px solid var(--border); font-size: 16px; }
.section-title small { color: var(--muted); font-weight: 400; }
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; }
.card button { width: 100%; padding: 0; border: 0; background: none; text-align: left; display: grid; gap: 4px; }
.thumb { position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border: 2px solid var(--border); border-left: 4px solid var(--u); overflow: hidden; }
.card button:hover .thumb { border-color: var(--border-strong); border-left-color: var(--u); }
/* Small pixel art scales up crisply instead of sitting as a dot in the middle. */
.thumb img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
.noprev { color: var(--muted); font-size: 12px; letter-spacing: 1px; }
.flag { position: absolute; top: 4px; right: 4px; padding: 0 6px; font-size: 11px; font-weight: 700; background: var(--text); color: var(--ink); }
.flag.changed { background: var(--u-unpublished); }
.bg-checker .thumb, .bg-checker .preview { background: repeating-conic-gradient(#1c2b31 0 25%, #10222a 0 50%) 0 0 / 16px 16px; }
.bg-dark .thumb, .bg-dark .preview { background: var(--ink); }
.bg-light .thumb, .bg-light .preview { background: #d9d4cb; }
.name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { border: 2px dashed var(--border); padding: 32px 16px; color: var(--muted); text-align: center; }
.more { display: block; margin: 20px auto; }
dialog { background: var(--surface); color: var(--text); border: 2px solid var(--border); padding: 0; width: min(920px, calc(100vw - 32px)); }
dialog::backdrop { background: rgb(5 9 11 / 80%); }
.detail { display: grid; grid-template-columns: 1fr; }
.preview { display: flex; align-items: center; justify-content: center; min-height: 280px; max-height: 70vh; }
.preview img { width: 100%; height: 100%; max-height: 70vh; object-fit: contain; image-rendering: pixelated; }
.info { padding: 16px; display: grid; gap: 8px; align-content: start; }
.info dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
.info dt { color: var(--muted); }
.info dd { margin: 0; word-break: break-all; }
.info .actions { display: flex; gap: 8px; margin-top: 8px; }
@media (min-width: 900px) {
  .layout { grid-template-columns: 280px 1fr; }
  .sidebar { border-bottom: 0; border-right: 2px solid var(--border); position: sticky; top: 0; height: 100dvh; overflow: auto; }
  .detail { grid-template-columns: 3fr 2fr; }
  .toolbar { position: sticky; top: 0; z-index: 2; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const SCRIPT = `
const PAGE = 240;
const state = {
  group: "", sub: "", text: "", shown: PAGE,
  usages: new Set(Object.keys(USAGES)), kinds: new Set(Object.keys(KINDS)), changes: new Set(Object.keys(CHANGES)),
};
const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const swatch = (usage) => {
  const dot = el("span", { className: "dot" });
  dot.style.setProperty("--u", "var(--u-" + usage + ")");
  return dot;
};
const src = (path) => path.split("/").map(encodeURIComponent).join("/");
const kb = (bytes) => bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + " KB" : (bytes / 1024 / 1024).toFixed(2) + " MB";

const matches = (r, ignoreTree = false) =>
  (ignoreTree || ((!state.group || r.group === state.group) && (!state.sub || r.sub === state.sub))) &&
  state.usages.has(r.usage) && state.kinds.has(r.kind) && state.changes.has(r.change) &&
  (!state.text || (r.path + " " + r.sub + " " + r.detail + " " + r.published.join(" ")).toLowerCase().includes(state.text));

function renderTree() {
  const pool = RECORDS.filter((r) => matches(r, true));
  const tree = $("#tree");
  tree.replaceChildren();
  const item = (label, count, group, sub) => {
    const current = state.group === group && state.sub === sub;
    const button = el("button", { type: "button" }, [el("span", { textContent: label }), el("span", { className: "n", textContent: count })]);
    button.setAttribute("aria-current", String(current));
    button.addEventListener("click", () => { state.group = group; state.sub = sub; state.shown = PAGE; render(); });
    return button;
  };
  tree.append(el("li", {}, [item("全部", pool.length, "", "")]));
  for (const group of Object.keys(GROUPS)) {
    const inGroup = pool.filter((r) => r.group === group);
    if (inGroup.length === 0) continue;
    const subs = [...new Set(inGroup.map((r) => r.sub))];
    const list = el("ul");
    for (const sub of subs) list.append(el("li", {}, [item(sub, inGroup.filter((r) => r.sub === sub).length, group, sub)]));
    tree.append(el("li", { className: "group" }, [item(GROUPS[group], inGroup.length, group, ""), list]));
  }
}

const visual = (r, lazy) => r.previewable
  ? el("img", { src: src(r.path), alt: lazy ? "" : r.name, loading: lazy ? "lazy" : "eager", decoding: "async" })
  : el("span", { className: "noprev", textContent: r.path.split(".").pop().toUpperCase() + " 無法預覽" });

function card(r) {
  const flag = r.change === "same" ? [] : [el("span", { className: "flag " + r.change, textContent: CHANGES[r.change] })];
  const button = el("button", { type: "button", title: r.path }, [
    el("span", { className: "thumb" }, [visual(r, true), ...flag]),
    el("span", { className: "name", textContent: r.name }),
    el("span", { className: "sub", textContent: [r.detail, USAGES[r.usage]].filter(Boolean).join(" · ") }),
  ]);
  button.addEventListener("click", () => openDetail(r));
  const li = el("li", { className: "card" }, [button]);
  li.style.setProperty("--u", "var(--u-" + r.usage + ")");
  return li;
}

function renderGrid() {
  const results = RECORDS.filter((r) => matches(r));
  $("#count").textContent = "顯示 " + Math.min(results.length, state.shown) + " / " + results.length + "（全部 " + RECORDS.length + "）";
  const out = $("#results");
  out.replaceChildren();
  if (results.length === 0) {
    out.append(el("p", { className: "empty", textContent: "沒有符合條件的素材。調整左側分類、用途或類型篩選，或清除搜尋字。" }));
    return;
  }
  let key = "";
  let grid = null;
  for (const r of results.slice(0, state.shown)) {
    const next = r.group + "/" + r.sub;
    if (next !== key) {
      key = next;
      const total = results.filter((x) => x.group === r.group && x.sub === r.sub).length;
      out.append(el("h2", { className: "section-title" }, [el("span", { textContent: GROUPS[r.group] + " › " + r.sub }), el("small", { textContent: total + " 個" })]));
      grid = el("ul", { className: "grid" });
      out.append(grid);
    }
    grid.append(card(r));
  }
  if (results.length > state.shown) {
    const more = el("button", { type: "button", className: "more", textContent: "再顯示 " + Math.min(PAGE, results.length - state.shown) + " 個" });
    more.addEventListener("click", () => { state.shown += PAGE; renderGrid(); });
    out.append(more);
  }
}

function openDetail(r) {
  const dialog = $("#detail");
  const img = visual(r, false);
  const size = el("dd", { textContent: kb(r.bytes) });
  img.addEventListener("load", () => { size.textContent = img.naturalWidth + " × " + img.naturalHeight + " px · " + kb(r.bytes); });
  const rows = [
    ["分類", GROUPS[r.group] + " › " + r.sub + (r.detail ? " › " + r.detail : "")],
    ["類型", KINDS[r.kind]],
    ["用途", USAGES[r.usage]],
    ["與上次比較", CHANGES[r.change]],
    ["網站路徑", r.published.length ? r.published.join("、") : "—"],
    ["原始路徑", r.path],
  ];
  const dl = el("dl");
  for (const [term, value] of rows) dl.append(el("dt", { textContent: term }), el("dd", { textContent: value }));
  dl.append(el("dt", { textContent: "尺寸" }), size);
  const copy = el("button", { type: "button", textContent: "複製原始路徑" });
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(r.path); copy.textContent = "已複製"; }
    catch { copy.textContent = "無法存取剪貼簿"; }
  });
  const close = el("button", { type: "button", textContent: "關閉" });
  close.addEventListener("click", () => dialog.close());
  const open = el("a", { href: src(r.path), target: "_blank", rel: "noopener", textContent: "開新分頁" });
  dialog.replaceChildren(el("div", { className: "detail" }, [
    el("div", { className: "preview" }, [img]),
    el("div", { className: "info" }, [el("strong", { textContent: r.name }), dl, el("div", { className: "actions" }, [copy, open, close])]),
  ]));
  dialog.showModal();
}

function chips(container, labels, selected) {
  for (const [key, label] of Object.entries(labels)) {
    const button = el("button", { type: "button" }, labels === USAGES ? [swatch(key), label] : [label]);
    button.setAttribute("aria-pressed", "true");
    button.addEventListener("click", () => {
      if (selected.has(key)) selected.delete(key); else selected.add(key);
      button.setAttribute("aria-pressed", String(selected.has(key)));
      state.shown = PAGE;
      render();
    });
    container.append(button);
  }
}

function setBackground(mode) {
  document.body.classList.remove("bg-checker", "bg-dark", "bg-light");
  document.body.classList.add("bg-" + mode);
  for (const b of document.querySelectorAll("#backgrounds button")) b.setAttribute("aria-pressed", String(b.dataset.bg === mode));
  try { localStorage.setItem("asset-gallery-bg", mode); } catch { /* storage unavailable: keep for this view */ }
}

function render() { renderTree(); renderGrid(); }

chips($("#usages"), USAGES, state.usages);
chips($("#kinds"), KINDS, state.kinds);
chips($("#changes"), CHANGES, state.changes);
for (const b of document.querySelectorAll("#backgrounds button")) b.addEventListener("click", () => setBackground(b.dataset.bg));
let saved = "checker";
try { saved = localStorage.getItem("asset-gallery-bg") || "checker"; } catch { /* storage unavailable */ }
setBackground(saved);
let timer = 0;
$("#search").addEventListener("input", (event) => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.text = event.target.value.trim().toLowerCase(); state.shown = PAGE; render(); }, 150);
});
// Phones start with the tree folded so the images come first.
if (matchMedia("(max-width: 899px)").matches) $("#tree-wrap").open = false;
render();
`;

type GalleryRecord = Omit<AssetRecord, "matched"> & { readonly previewable: boolean };

/** A standalone page for browsing the raw assets by group and sub-item; it sits in source-data next to Assets/. */
export function renderGallery(records: readonly AssetRecord[], rules: AssetRules, generatedAt = ""): string {
  const data: GalleryRecord[] = records.map(({ matched: _matched, ...rest }) => ({ ...rest, previewable: isPreviewable(rest.name) }));
  const changed = records.filter((record) => record.change !== "same").length;
  return `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>原始素材圖庫</title>
<style>${STYLE}</style>
</head>
<body class="bg-checker">
<div class="layout">
  <nav class="sidebar" aria-label="分類">
    <h1>原始素材圖庫</h1>
    <p class="meta">${records.length} 個檔案${generatedAt ? ` · 產生於 ${generatedAt}` : ""}${changed ? ` · 本次變動 ${changed}` : ""} · 執行 <code>npm run assets</code> 更新</p>
    <details class="tree-wrap" id="tree-wrap" open>
      <summary>分類與分項</summary>
      <ul class="tree" id="tree"></ul>
    </details>
  </nav>
  <main class="main">
    <div class="toolbar">
      <input id="search" type="search" placeholder="搜尋檔名、路徑、細項或網站路徑…" aria-label="搜尋素材" />
      <div class="chips" id="usages" role="group" aria-label="用途"><span class="label">用途</span></div>
      <div class="chips" id="kinds" role="group" aria-label="類型"><span class="label">類型</span></div>
      <div class="chips" id="changes" role="group" aria-label="與上次比較"><span class="label">變動</span></div>
      <div class="chips" id="backgrounds" role="group" aria-label="預覽底色"><span class="label">底色</span>
        <button type="button" data-bg="checker">格紋</button><button type="button" data-bg="dark">深</button><button type="button" data-bg="light">淺</button>
      </div>
      <span class="count" id="count" aria-live="polite"></span>
    </div>
    <div id="results"></div>
  </main>
</div>
<dialog id="detail" aria-label="素材詳情"></dialog>
<script>
const GROUPS = ${scriptJson(rules.groups)};
const CHANGES = ${scriptJson(CHANGES)};
const KINDS = ${scriptJson(KINDS)};
const USAGES = ${scriptJson(USAGES)};
const RECORDS = ${scriptJson(data)};
${SCRIPT}
</script>
</body>
</html>
`;
}
