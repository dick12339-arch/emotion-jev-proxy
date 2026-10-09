# Emotion JEV Proxy - OpenRouter 代理

這個 Worker 解決 `container://` 預覽和本地 HTML 無法直接打 OpenRouter 的 CORS / Referer 問題。

## 一鍵部署到 Cloudflare

### 方法 A：GitHub 連動 (推薦)
1. 把這個 repo Fork / 上傳到你的 GitHub
2. 去 Cloudflare Dash -> Workers & Pages -> Create -> **Connect to Git**
3. 選這個 repo，Cloudflare 會自動偵測 `wrangler.toml` 自動部署
4. 部署後去 Settings -> Variables -> 新增 `OPENROUTER_API_KEY` = `sk-or-v1-...`

### 方法 B：本機 Wrangler
```bash
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put OPENROUTER_API_KEY
```

## 直接使用
打開 Worker 網址就是轉譯器操作頁面；`/health` 可檢查 Key 是否已設定。

## 其他前端怎麼用
把部署後的網址 `https://emotion-jev-proxy.xxx.workers.dev` 貼回轉譯器的 **代理模式 URL** 欄位。

支援兩種模式：
- 模式A (安全)：Key 藏在 Worker 環境變數，前端不傳 key（有設環境變數時一律優先使用）
- 模式B (測試)：前端 POST body 帶 `apiKey`（僅在 Worker 沒設環境變數時使用）

## 選用環境變數
- `DEFAULT_MODEL`：預設模型 ID，必須是 `:free` 結尾的免費模型，未設定則用 `src/index.js` 裡 `FREE_MODELS` 的第一個

## 免費模型
- 只允許 `:free` 模型，前端傳其他模型會被改成預設，不會產生費用
- 可選模型清單在 `src/index.js` 的 `FREE_MODELS`，改這裡就會同步更新頁面下拉選單
- 選定模型忙碌時，OpenRouter 會自動改用清單中的下一個免費模型

## POST body 格式
```json
{ "messages": [{ "role": "user", "content": "你好" }], "model": "可省略", "temperature": 0.3, "max_tokens": 800 }
```
