import "./style.css";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFDocumentLoadingTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocument } from "pdf-lib";
import {
  impose,
  loadSource,
  orderBooklet,
  PAPERS,
  MAX_BYTES,
  type Settings,
  type Paper,
  type Binding,
} from "./imposition";
import { createSample } from "./sample";

GlobalWorkerOptions.workerSrc = workerUrl;
const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
$("#app").innerHTML = /* HTML */ ` <header class="masthead">
    <a href="./" class="wordmark" aria-label="Foldpress 首頁"
      ><span class="mark" aria-hidden="true">f</span>foldpress</a
    >
    <div class="mast-note">
      THE DESKTOP PRINT WORKSHOP<span>你的桌上印刷所</span>
    </div>
    <a class="guide-link" href="#print-guide"
      >列印指南 <span aria-hidden="true">↗</span></a
    >
  </header>
  <main>
    <section class="intro" aria-labelledby="title">
      <div>
        <p class="eyebrow"><span></span> PDF IN. LITTLE BOOK OUT.</p>
        <h1 id="title">A small press.<br /><em>In your browser.</em></h1>
      </div>
      <div class="intro-note">
        <span class="intro-symbol" aria-hidden="true">✳</span>
        <p>把一份 PDF，折成一本小書。</p>
        <p class="muted">
          排好頁序、雙面列印、對折裝訂。<br />讀書筆記、攝影小誌，或下一個好點子。
        </p>
        <p class="local-note">
          <span aria-hidden="true">●</span> 檔案只留在你的瀏覽器
        </p>
      </div>
    </section>
    <section class="workshop" aria-label="小冊拼版工作區">
      <aside class="controls">
        <div class="section-label">
          <span>01 / 原稿</span><span>THE ORIGINAL</span>
        </div>
        <label class="dropzone" id="dropzone" for="file"
          ><span class="upload-icon" aria-hidden="true">↑</span
          ><strong>放入你的 PDF</strong><span>拖曳檔案，或點這裡選擇</span
          ><small>最多 40 MB · 160 頁</small
          ><input id="file" type="file" accept="application/pdf,.pdf"
        /></label>
        <div class="source">
          <span class="file-icon" aria-hidden="true">PDF</span>
          <div>
            <strong id="source-name">準備紙張範例…</strong
            ><span id="source-detail">12 頁 · Paper studies</span>
          </div>
          <span class="source-dot" aria-hidden="true"></span>
        </div>
        <button class="sample-button" id="sample" type="button">
          用 12 頁範例試試 <span aria-hidden="true">↗</span>
        </button>
        <div class="section-label settings-label">
          <span>02 / 拼版</span><span>THE SETUP</span>
        </div>
        <label class="field" for="paper"
          ><span>列印紙張</span
          ><select id="paper">
            <option value="A4">A4 — 297 × 210 mm</option>
            <option value="A3">A3 — 420 × 297 mm</option>
            <option value="Letter">Letter — 11 × 8.5 in</option>
          </select></label
        >
        <fieldset class="binding">
          <legend>裝訂方向</legend>
          <div class="segmented">
            <label
              ><input type="radio" name="binding" value="left" checked /><span
                >左側裝訂 <i aria-hidden="true">▤</i></span
              ></label
            ><label
              ><input type="radio" name="binding" value="right" /><span
                >右側裝訂 <i aria-hidden="true">▥</i></span
              ></label
            >
          </div>
        </fieldset>
        <label class="margin-label" for="margin"
          ><span>每頁留白</span
          ><output id="margin-value" for="margin">5 mm</output></label
        ><input id="margin" type="range" min="0" max="20" step="1" value="5" />
        <div class="range-label"><span>0 mm</span><span>20 mm</span></div>
        <div class="job-summary">
          <div><span>原稿頁數</span><strong id="pages">12</strong></div>
          <div><span>需要紙張</span><strong id="sheets">3 張</strong></div>
          <div><span>補入空白</span><strong id="blanks">0 頁</strong></div>
        </div>
        <button id="export" class="export-button" type="button" disabled>
          下載列印 PDF <span aria-hidden="true">↓</span>
        </button>
        <p class="export-note" id="export-note">依序輸出正、反面 · 橫式紙張</p>
      </aside>
      <div class="preview-area">
        <div class="preview-top">
          <div class="section-label">
            <span>03 / 印刷預覽</span><span>ON THE PRESS</span>
          </div>
          <span class="preview-badge" id="paper-badge">A4 LANDSCAPE</span>
        </div>
        <div class="sheet-toolbar">
          <p>
            <strong id="sheet-heading">第一張紙</strong
            ><span id="sheet-subtitle">最外層 · 封面與封底</span>
          </p>
          <div class="side-switch" role="group" aria-label="紙張正反面">
            <button type="button" id="front" class="active" aria-pressed="true">
              正面</button
            ><button type="button" id="back" aria-pressed="false">反面</button>
          </div>
        </div>
        <div class="press-bed">
          <div class="top-measure">
            <span></span><span id="measure">297 mm</span><span></span>
          </div>
          <div class="paper-wrap">
            <div
              id="preview"
              class="paper-preview"
              role="img"
              aria-label="拼版預覽"
              aria-busy="true"
            >
              <p class="preview-placeholder">正在整理頁序…</p>
            </div>
            <span class="fold-line" aria-hidden="true"></span
            ><span class="crop crop-tl" aria-hidden="true"></span
            ><span class="crop crop-tr" aria-hidden="true"></span
            ><span class="crop crop-bl" aria-hidden="true"></span
            ><span class="crop crop-br" aria-hidden="true"></span>
          </div>
          <div class="page-labels">
            <span id="left-page">第 12 頁</span
            ><span class="fold-label">對折線</span
            ><span id="right-page">第 1 頁</span>
          </div>
        </div>
        <div class="preview-bottom">
          <span class="preview-help">等比例置中 · 不裁切內容</span>
          <div class="sheet-nav">
            <button id="prev" type="button" aria-label="上一張紙">←</button
            ><span id="sheet-position">01 <i>/ 03</i></span
            ><button id="next" type="button" aria-label="下一張紙">→</button>
          </div>
        </div>
        <p id="status" class="status" role="status" aria-live="polite">
          正在準備範例…
        </p>
        <details class="limits">
          <summary>檔案支援範圍</summary>
          <p>
            支援未加密 PDF、直角旋轉與 CropBox
            裁切。表單及註解請先壓平；連結的互動區與外框不會輸出。畫面上的對折線與裁切輔助線不會印出。檔案不會上傳，重新整理即清除。
          </p>
        </details>
      </div>
    </section>
    <section class="print-guide" id="print-guide" aria-labelledby="guide-title">
      <div class="guide-intro">
        <p class="eyebrow">FROM SCREEN TO PAPER</p>
        <h2 id="guide-title">Three steps.<br /><em>One little book.</em></h2>
        <p>第一次印，先用一張紙試印正反面。</p>
      </div>
      <ol class="guide-steps">
        <li>
          <span class="step-number">01</span>
          <h3>雙面列印</h3>
          <p>
            橫式、實際大小（100%），選擇<strong>短邊翻轉</strong>。不要再套用印表機的小冊子拼版。
          </p>
        </li>
        <li>
          <span class="step-number">02</span>
          <h3>依序疊好</h3>
          <p>第 1 張放最外層，其餘紙張往內套疊。封面朝外，沿著中間對折。</p>
        </li>
        <li>
          <span class="step-number">03</span>
          <h3>裝訂成冊</h3>
          <p>在書脊釘上兩針，或用線縫合。紙張越厚，越適合減少頁數。</p>
        </li>
      </ol>
    </section>
  </main>
  <footer>
    <span class="footer-brand">foldpress</span
    ><span>A TOOL FOR THINGS WORTH PRINTING.</span
    ><a
      href="https://github.com/Miiduoa/foldpress"
      target="_blank"
      rel="noopener noreferrer"
      >Source on GitHub ↗</a
    >
  </footer>`;

let source: PDFDocument | null = null;
let sourceName = "paper-studies.pdf";
let outputBytes: Uint8Array | null = null;
let outputDocument: PDFDocumentProxy | null = null;
let outputTask: PDFDocumentLoadingTask | null = null;
let sheetIndex = 0;
let side: "front" | "back" = "front";
let importRevision = 0;
let buildRevision = 0;
let renderRevision = 0;
let importing = false;
let building = false;
const settings: Settings = { paper: "A4", binding: "left", marginMm: 5 };
const status = (message: string, error = false) => {
  $("#status").textContent = message;
  $("#status").classList.toggle("error", error);
};
function updateExport() {
  $<HTMLButtonElement>("#export").disabled =
    importing || building || !outputBytes;
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "#paper, #margin, input[name=binding]",
    )
    .forEach((input) => {
      input.disabled = importing;
    });
}
function refreshLabels() {
  if (!source) return;
  const sheets = orderBooklet(source.getPageCount(), settings.binding);
  sheetIndex = Math.min(sheetIndex, sheets.length - 1);
  const pair = sheets[sheetIndex][side];
  $("#pages").textContent = String(source.getPageCount());
  $("#sheets").textContent = `${sheets.length} 張`;
  $("#blanks").textContent = `${sheets.length * 4 - source.getPageCount()} 頁`;
  $("#sheet-heading").textContent = `第 ${sheetIndex + 1} 張紙`;
  $("#sheet-subtitle").textContent =
    sheetIndex === 0
      ? "最外層 · 封面與封底"
      : sheetIndex === sheets.length - 1
        ? "最內層 · 書心"
        : "由外向內套疊";
  $("#sheet-position").innerHTML =
    `${String(sheetIndex + 1).padStart(2, "0")} <i>/ ${String(sheets.length).padStart(2, "0")}</i>`;
  $("#left-page").textContent =
    pair[0] === null ? "空白頁" : `第 ${pair[0]} 頁`;
  $("#right-page").textContent =
    pair[1] === null ? "空白頁" : `第 ${pair[1]} 頁`;
  $("#paper-badge").textContent = `${settings.paper.toUpperCase()} LANDSCAPE`;
  $("#measure").textContent =
    settings.paper === "Letter"
      ? "11 in"
      : settings.paper === "A3"
        ? "420 mm"
        : "297 mm";
  const paper = PAPERS[settings.paper];
  $("#preview").style.aspectRatio = `${paper.width} / ${paper.height}`;
  $<HTMLButtonElement>("#prev").disabled = sheetIndex === 0;
  $<HTMLButtonElement>("#next").disabled = sheetIndex === sheets.length - 1;
  for (const name of ["front", "back"] as const) {
    $(`#${name}`).classList.toggle("active", side === name);
    $(`#${name}`).setAttribute("aria-pressed", String(side === name));
  }
}
async function renderPreview(): Promise<boolean> {
  const revision = ++renderRevision;
  const document = outputDocument;
  if (!document) return false;
  $("#preview").setAttribute("aria-busy", "true");
  try {
    const page = await document.getPage(
      sheetIndex * 2 + (side === "front" ? 1 : 2),
    );
    if (revision !== renderRevision) return false;
    const viewport = page.getViewport({
      scale: 1300 / page.getViewport({ scale: 1 }).width,
    });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    if (revision !== renderRevision) return false;
    $("#preview").replaceChildren(canvas);
    $("#preview").setAttribute(
      "aria-label",
      `第 ${sheetIndex + 1} 張紙${side === "front" ? "正面" : "反面"}，${$("#left-page").textContent}與${$("#right-page").textContent}`,
    );
    $("#preview").setAttribute("aria-busy", "false");
    return true;
  } catch {
    if (revision !== renderRevision) return false;
    $("#preview").setAttribute("aria-busy", "false");
    status("無法顯示預覽，請嘗試重新匯入 PDF。", true);
    return false;
  }
}
async function rebuild() {
  if (!source) return;
  const revision = ++buildRevision;
  ++renderRevision;
  building = true;
  outputBytes = null;
  updateExport();
  refreshLabels();
  $("#preview").setAttribute("aria-busy", "true");
  status("正在排列頁序…");
  const currentSource = source;
  const currentSettings = { ...settings };
  let pendingTask: PDFDocumentLoadingTask | null = null;
  try {
    const bytes = await impose(currentSource, currentSettings);
    if (revision !== buildRevision) return;
    // PDF.js 6 removed the former eval option. Only render artwork; never create a scripting or annotation layer.
    const task = getDocument({ data: new Uint8Array(bytes) });
    pendingTask = task;
    const pdf = await task.promise;
    if (revision !== buildRevision) {
      await task.destroy();
      return;
    }
    const previous = outputTask;
    outputDocument = pdf;
    outputTask = task;
    pendingTask = null;
    outputBytes = bytes;
    building = false;
    updateExport();
    const rendered = await renderPreview();
    if (previous) await previous.destroy();
    if (revision !== buildRevision || !rendered) return;
    status(
      `已排好 ${orderBooklet(currentSource.getPageCount()).length} 張紙。下載後使用雙面列印、短邊翻轉。`,
    );
  } catch (error) {
    if (pendingTask) await pendingTask.destroy().catch(() => {});
    if (revision !== buildRevision) return;
    building = false;
    updateExport();
    $("#preview").setAttribute("aria-busy", "false");
    status(error instanceof Error ? error.message : "無法完成拼版。", true);
  }
}
async function importPdf(readBytes: () => Promise<Uint8Array>, name: string) {
  const revision = ++importRevision;
  ++buildRevision;
  ++renderRevision;
  importing = true;
  building = false;
  updateExport();
  status("正在讀取 PDF…");
  try {
    const bytes = await readBytes();
    if (revision !== importRevision) return;
    const next = await loadSource(bytes);
    if (revision !== importRevision) return;
    source = next;
    sourceName = name;
    sheetIndex = 0;
    side = "front";
    $("#source-name").textContent = name;
    $("#source-detail").textContent =
      `${next.getPageCount()} 頁 · ${(bytes.byteLength / 1024).toFixed(0)} KB · 本機檔案`;
    importing = false;
    await rebuild();
  } catch (error) {
    if (revision !== importRevision) return;
    importing = false;
    updateExport();
    if (source && !outputBytes) await rebuild();
    if (revision !== importRevision) return;
    status(error instanceof Error ? error.message : "無法讀取這份 PDF。", true);
  }
}
function acceptFile(file: File | undefined) {
  if (!file) return;
  void importPdf(async () => {
    if (file.size > MAX_BYTES)
      throw new Error("這份檔案超過 40 MB。請先縮小 PDF 再試一次。");
    return new Uint8Array(await file.arrayBuffer());
  }, file.name);
}
$<HTMLInputElement>("#file").addEventListener("change", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  acceptFile(input.files?.[0]);
  input.value = "";
});
const drop = $("#dropzone");
for (const name of ["dragenter", "dragover"])
  drop.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.add("dragging");
  });
for (const name of ["dragleave", "drop"])
  drop.addEventListener(name, () => drop.classList.remove("dragging"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  acceptFile(event.dataTransfer?.files[0]);
});
// Keep accidental drops outside the target from navigating away from the application.
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());
$("#sample").addEventListener(
  "click",
  () => void importPdf(createSample, "paper-studies.pdf"),
);
$<HTMLSelectElement>("#paper").addEventListener("change", (event) => {
  settings.paper = (event.currentTarget as HTMLSelectElement).value as Paper;
  if (!importing) void rebuild();
});
document
  .querySelectorAll<HTMLInputElement>('input[name="binding"]')
  .forEach((input) =>
    input.addEventListener("change", () => {
      settings.binding = input.value as Binding;
      if (!importing) void rebuild();
    }),
  );
$<HTMLInputElement>("#margin").addEventListener("input", (event) => {
  settings.marginMm = Number((event.currentTarget as HTMLInputElement).value);
  $("#margin-value").textContent = `${settings.marginMm} mm`;
  if (!importing) void rebuild();
});
for (const name of ["front", "back"] as const)
  $(`#${name}`).addEventListener("click", () => {
    side = name;
    refreshLabels();
    if (!building) void renderPreview();
  });
$("#prev").addEventListener("click", () => {
  sheetIndex = Math.max(0, sheetIndex - 1);
  refreshLabels();
  if (!building) void renderPreview();
});
$("#next").addEventListener("click", () => {
  if (!source) return;
  sheetIndex = Math.min(
    orderBooklet(source.getPageCount()).length - 1,
    sheetIndex + 1,
  );
  refreshLabels();
  if (!building) void renderPreview();
});
$("#export").addEventListener("click", () => {
  if (!outputBytes || importing || building) return;
  const buffer = new Uint8Array(outputBytes).buffer;
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sourceName.replace(/\.pdf$/i, "")}-booklet-${settings.paper}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  status("PDF 已準備下載。列印時選擇「實際大小」與「短邊翻轉」。");
});
void importPdf(createSample, "paper-studies.pdf");
