# Design notes

## 工作台的順序

原稿、紙張設定、印刷預覽，依照實際動手做一本小書的順序排列。桌面畫面把設定與紙張放在一起；窄螢幕改成單欄，保留可讀的控制項尺寸。紙張周圍的對折線與裁切標記是畫面輔助，不會寫入下載檔案。

介面使用系統無襯線字體搭配 Georgia。暖白、朱紅、鉛筆色框線來自紙本工作台，不依賴圖片背景或遠端字型。預設範例不是裝飾：它是可下載的真實十二頁原稿，能完整走過拼版與列印流程。

## 一份輸出、兩個用途

pdf-lib 先建立印刷 PDF；PDF.js 直接渲染這份輸出，下載使用同一組 bytes。如此不需要維護一套 DOM 預覽和另一套 PDF 幾何計算，也避免使用者看到的左右頁與實際檔案不一致。

每一原稿頁依 CropBox 嵌入，先將裁切原點歸零，再按 PDF 的順時針 Rotate 值放置到左右格子。頁面保留自身比例，格子留白是最低邊距；不同長寬比可能產生更大的空白。

輸出頁面永遠是橫式，正反面交替。左側裝訂的第 `i` 張紙（從 0 起算），正面是 `[N - 2i, 1 + 2i]`，反面是 `[2 + 2i, N - 1 - 2i]`；`N` 是補齊至四的倍數後的總頁數。右側裝訂交換每一對的位置。

## 狀態與限制

匯入、重建與預覽各有獨立的 revision。舊操作即使晚一步完成，也不能覆寫新操作的結果。匯入期間停用拼版設定；重建期間停用下載。新預覽取代舊預覽後，銷毀舊 PDF.js loading task，釋放 worker 與資源。

PDF.js 6 不再提供舊版 `isEvalSupported` 參數。此處只呼叫 core 的頁面 canvas renderer，沒有安裝 annotation layer、scripting manager 或執行文件動作。程式與 worker 同源自託管。

pdf-lib 的頁面嵌入不保留註解與互動表單。表單及非連結註解明確拒收，避免產生看似成功、實際遺漏使用者填寫內容的列印檔。一般 Link 註解可接受，連結熱區及外框的省略會在介面與 README 說明。沒有 Contents 的空白原稿頁不需嵌入，保留它的頁序即可。

目前每次調整設定都重建整份 PDF；160 頁上限、按需顯示單面預覽與固定 canvas 尺寸將成本限制在適合桌面小冊子的範圍。仍未提供大型 PDF 的增量處理或記憶體硬上限。

## 驗證範圍

單元測試遍歷 1–160 頁以及兩種裝訂方向，確認不重複、不遺漏、只補入必要空白。整合測試以 PDF.js 讀回匯出 PDF，檢查內容順序、頁面尺寸、左右位置、旋轉與裁切原點；同時檢查空白頁、表單拒收與輸入上限。

實體紙張的出紙方向、雙面器設定、厚紙折損、爬移與裝訂精度仍需使用者試印。螢幕預覽不是印刷廠色彩校樣。

## References

- [pdf-lib PDFPage API](https://pdf-lib.js.org/docs/api/classes/pdfpage)
- [pdf-lib PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)
- [PDF.js examples](https://mozilla.github.io/pdf.js/examples/)
- [PDF.js API](https://mozilla.github.io/pdf.js/api/)
