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
$("#app").innerHTML = /* HTML */ `<header class="app-header">
    <a class="wordmark" href="./" aria-label="Foldpress 首頁">Foldpress</a>
    <h1>PDF 小冊拼版</h1>
    <span class="local-note">檔案在瀏覽器內處理，不會上傳</span>
    <a
      href="https://github.com/Miiduoa/foldpress"
      target="_blank"
      rel="noopener noreferrer"
      >GitHub</a
    >
  </header>
  <main>
    <section class="file-bar" id="dropzone" aria-label="目前檔案與匯入">
      <span class="file-icon" aria-hidden="true">PDF</span>
      <div class="source">
        <strong id="source-name">正在開啟測試冊…</strong
        ><span id="source-detail">12 頁</span>
      </div>
      <div class="file-actions">
        <button class="sample-button" id="sample" type="button">
          開啟測試冊
        </button>
        <label class="upload-button" for="file"
          >選擇 PDF<input id="file" type="file" accept="application/pdf,.pdf"
        /></label>
      </div>
      <span class="drop-hint">也可將檔案拖到這裡 · 上限 40 MB / 160 頁</span>
    </section>
    <div class="workshop">
      <aside class="controls" aria-label="拼版設定">
        <h2>紙張與裝訂</h2>
        <label class="field" for="paper"
          ><span>列印紙張</span
          ><select id="paper">
            <option value="A4">A4（297 × 210 mm）</option>
            <option value="A3">A3（420 × 297 mm）</option>
            <option value="Letter">Letter（11 × 8.5 in）</option>
          </select></label
        >
        <fieldset class="binding">
          <legend>裝訂方向</legend>
          <div class="segmented">
            <label
              ><input type="radio" name="binding" value="left" checked /><span
                >左側</span
              ></label
            ><label
              ><input type="radio" name="binding" value="right" /><span
                >右側</span
              ></label
            >
          </div>
        </fieldset>
        <label class="margin-label" for="margin"
          ><span>每頁留白</span
          ><output id="margin-value" for="margin">5 mm</output></label
        >
        <input id="margin" type="range" min="0" max="20" step="1" value="5" />
        <div class="range-label"><span>0 mm</span><span>20 mm</span></div>
        <p class="field-note">內容等比例縮放，置於每半張紙的中央。</p>
        <dl class="job-summary">
          <div>
            <dt>原稿</dt>
            <dd id="pages">12</dd>
          </div>
          <div>
            <dt>列印用紙</dt>
            <dd id="sheets">3 張</dd>
          </div>
          <div>
            <dt>補入空白</dt>
            <dd id="blanks">0 頁</dd>
          </div>
        </dl>
        <button id="export" class="export-button" type="button" disabled>
          下載拼版 PDF
        </button>
        <p class="export-note" id="export-note">
          輸出順序：每張紙的正面、反面。
        </p>
        <div class="print-settings">
          <h3>列印時請設定</h3>
          <p>
            橫式 · 實際大小（100%）<br /><strong>雙面列印，短邊翻轉</strong>
          </p>
          <p>不要再勾選印表機的「小冊子」拼版。首次使用先試印一張紙。</p>
        </div>
      </aside>
      <section class="preview-area" aria-label="拼版預覽">
        <div class="preview-top">
          <h2>拼版預覽</h2>
          <span id="paper-badge">A4 · 橫式</span>
        </div>
        <div class="sheet-toolbar">
          <div class="sheet-info">
            <strong id="sheet-heading">第 1 張紙</strong
            ><span id="sheet-subtitle">最外層 · 封面與封底</span>
          </div>
          <div class="side-switch" role="group" aria-label="紙張正反面">
            <button type="button" id="front" class="active" aria-pressed="true">
              正面</button
            ><button type="button" id="back" aria-pressed="false">反面</button>
          </div>
        </div>
        <div class="press-bed">
          <div class="paper-wrap">
            <div
              id="preview"
              class="paper-preview"
              role="img"
              aria-label="拼版預覽"
              aria-busy="true"
            >
              <p class="preview-placeholder">正在排列頁序…</p>
            </div>
            <span class="fold-line" aria-hidden="true"></span>
          </div>
          <div class="page-labels">
            <span id="left-page">第 12 頁</span
            ><span class="fold-label">對折</span
            ><span id="right-page">第 1 頁</span>
          </div>
        </div>
        <div class="preview-bottom">
          <span class="preview-help"
            >紙張寬度 <span id="measure">297 mm</span> · 摺線不會印出</span
          >
          <div class="sheet-nav">
            <button id="prev" type="button" aria-label="上一張紙">←</button
            ><span id="sheet-position">1 / 3</span
            ><button id="next" type="button" aria-label="下一張紙">→</button>
          </div>
        </div>
        <p id="status" class="status" role="status" aria-live="polite">
          正在準備測試冊…
        </p>
      </section>
    </div>
    <div class="help-area">
      <details id="print-guide">
        <summary>如何把印好的紙裝成小冊？</summary>
        <p>
          依序將第 1
          張放在最外層，其餘紙張往內套疊。確認封面朝外後，沿中間對折，再在書脊裝訂。頁數多或紙張厚時，先將原稿拆成較薄的幾本。
        </p>
      </details>
      <details class="limits">
        <summary>支援的 PDF 與限制</summary>
        <p>
          支援未加密 PDF、直角旋轉與 CropBox
          裁切。表單及註解請先壓平；連結的互動區與外框不會輸出。檔案不會上傳，重新整理即清除。
        </p>
      </details>
    </div>
  </main> `;

let source: PDFDocument | null = null;
let sourceName = "test-booklet.pdf";
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
  $("#pages").textContent = `${source.getPageCount()} 頁`;
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
    `${sheetIndex + 1} <span>/ ${sheets.length}</span>`;
  $("#left-page").textContent =
    pair[0] === null ? "空白頁" : `第 ${pair[0]} 頁`;
  $("#right-page").textContent =
    pair[1] === null ? "空白頁" : `第 ${pair[1]} 頁`;
  $("#paper-badge").textContent = `${settings.paper} · 橫式`;
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
  () => void importPdf(createSample, "test-booklet.pdf"),
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
void importPdf(createSample, "test-booklet.pdf");
