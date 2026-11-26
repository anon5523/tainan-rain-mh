# 南雨人孔調查表快找｜部署說明

## 包裡有什麼
| 檔案 | 用途 |
|---|---|
| `index.html` | 網站本體（已內含全部人孔資料） |
| `netlify.toml` | Netlify 設定 |
| `netlify/functions/line.mjs`、`mh-data.mjs` | LINE 機器人程式與資料 |

## 功能一覽
- 🔍 查詢：行政區＋編號篩選、📷 拍孔蓋噴字自動辨識編號
- 🗺️ 地圖：全市人孔依頂高程上色，點人孔看資料與推測水流方向（電子地圖／正射影像切換）
- 🧭 指南針：箭頭指向目標人孔、顯示距離，抵達時震動
- 📍 附近：GPS 或貼座標，列出最近 15 個人孔
- 📋 區內：列出某區全部有效調查表
- 💬 LINE 機器人：在 LINE 打編號回傳資料卡、傳位置回傳最近 5 個人孔

---

## 第一部分：網站上線（建議用 GitHub＋Netlify，之後 LINE 機器人也能一起用）

> 只要網站、不需要 LINE 機器人：直接把整個資料夾拖到 https://app.netlify.com/drop 即可（記得一小時內註冊認領）。

### A. 把檔案放上 GitHub（約 5 分鐘）
1. 到 https://github.com 註冊／登入。
2. 右上角「＋」→「New repository」，名稱填 `tainan-rain-mh`，選 **Private**（私人），按「Create repository」。
3. 在新的 repository 頁面點「uploading an existing file」。
4. 把解壓縮後資料夾裡的**所有檔案和 netlify 資料夾**一起拖進去（用 Chrome 或 Edge 才能拖資料夾）。
5. 確認清單裡有 `netlify/functions/line.mjs`，按「Commit changes」。

### B. Netlify 從 GitHub 部署（約 3 分鐘）
1. 登入 https://app.netlify.com →「Add new project」→「Import an existing project」→「GitHub」，授權後選 `tainan-rain-mh`。
2. Build command 留空、Publish directory 填 `.`，按「Deploy」。
3. 完成後「Project configuration」→「Change project name」改成 `tainan-rain-mh`，網址變成 `https://tainan-rain-mh.netlify.app`。
4. 用手機打開網址，確認查得到人孔。

### 之後更新資料
到 GitHub repository 用「Add file → Upload files」上傳新的 `index.html`（和 `mh-data.mjs`），Netlify 約 1 分鐘內自動更新。

---

## 第二部分：LINE 機器人（約 15 分鐘，免費）

### 1. 建立 LINE 官方帳號
1. 打開 https://manager.line.biz ，用 LINE 帳號登入 →「建立帳號」，名稱例如「南雨人孔快找」。
2. 進入官方帳號後台 → 右上「設定」→「Messaging API」→「啟用 Messaging API」，選擇或新增一個提供者（Provider）。

### 2. 取得兩把鑰匙
1. 打開 https://developers.line.biz/console/ → 點剛剛的 Provider → 點這個官方帳號的頻道。
2. 「Basic settings」分頁往下找 **Channel secret**，複製起來。
3. 「Messaging API」分頁最下方 **Channel access token (long-lived)** → 按「Issue」，複製起來。

### 3. 把鑰匙放進 Netlify
1. Netlify 專案 →「Project configuration」→「Environment variables」→「Add a variable」，新增三個：
   - `LINE_CHANNEL_SECRET`：貼上 Channel secret
   - `LINE_CHANNEL_ACCESS_TOKEN`：貼上 Channel access token
   - `SITE_URL`：你的網址，例如 `https://tainan-rain-mh.netlify.app`
2. 「Deploys」→「Trigger deploy」→「Deploy project」，讓設定生效。
3. 用瀏覽器打開 `https://你的網址/api/line`，看到「南雨人孔 LINE 機器人運作中」就成功了。

### 4. 接上 LINE
1. 回到 LINE Developers 的「Messaging API」分頁 → **Webhook URL** 填 `https://你的網址/api/line` →「Update」→ 按「Verify」應顯示 Success。
2. 打開 **Use webhook**。
3. 回到官方帳號後台 →「設定」→「回應設定」：**Webhook 開啟**、**自動回應訊息關閉**、加入好友的歡迎訊息可關閉（機器人會自己打招呼）。

### 5. 開始使用
- 用手機掃 Messaging API 分頁上的 QR code 加好友，或把官方帳號邀進工作群組。
- 打 `CWCR387`、`中西區 387`、`cwcr387` → 回傳人孔資料卡（頂高程、深度、底高程、座標、調查表與地圖按鈕）。
- 按下方「📍 找我附近的人孔」傳送位置 → 回傳最近 5 個人孔。
- 打區名（例如「北區」）→ 回傳該區代碼。

### 費用
- LINE 官方帳號免費方案即可；機器人只用「回覆訊息」，依 LINE 目前規則不計入每月訊息則數。LINE 各地方案偶有調整，以官方帳號後台公告為準。
- Netlify 免費方案每月有一定的函式執行額度，小團隊查詢用量遠低於上限。

### 若 /api/line 打開是 404
表示函式沒有部署到。請確認：是用 GitHub 部署（拖拉部署可能不會建置函式）、`netlify/functions/line.mjs` 有上傳、`netlify.toml` 在最上層。到 Netlify「Logs → Functions」應看到 `line`。

---

## 加到手機主畫面
用手機瀏覽器打開網址 → 分享（iPhone）或選單（Android）→「加入主畫面」。

## 資料來源
臺南市政府水利局「系統人孔 shp 及屬性表（114/09/10 版）」；調查表連結於 2026/11/24 逐一確認。水利局更新資料後，需要重新產生 `index.html` 與 `mh-data.mjs`。
