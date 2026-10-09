// Emotion JEV Proxy — 情緒價值客服轉譯器
// GET  /            → 轉譯器操作頁面（打開網址就能用）
// GET  /pad         → 客服草稿窗：邊打字邊給邏輯建議（適合開成小視窗放在 LINE 旁邊）
// POST /            → 轉送到 OpenRouter（Key 優先使用 Cloudflare 環境變數 OPENROUTER_API_KEY）
// POST /api/review  → 客服草稿邏輯檢查，回傳整理好的 JSON
// GET  /health      → 檢查 Key、模型與版本

// ── 版本資訊（每次更新都要同步改這裡）──
const VERSION = '1.1.0';
const CHANGELOG = [
  { v: '1.1.0', date: '2026-10-09', notes: [
    '新增「客服草稿窗」/pad：打字停頓約 1.5 秒自動檢查邏輯，給評分、問題點、該先問客人的事與建議改寫',
    '新增 /api/review 檢查 API（可給其他工具呼叫）',
    '送出前自動遮蔽電話、Email、長串號碼，避免客人個資送到 AI',
    '轉譯器頁與草稿窗都加上版本資訊',
  ] },
  { v: '1.0.0', date: '2026-10-09', notes: [
    '情緒價值客服轉譯器首版：打開 Worker 網址即可使用',
    '只使用免費模型，可下拉選擇，忙碌時自動改用下一個',
  ] },
];

// 只允許免費模型（ID 以 :free 結尾），第一個是預設
const FREE_MODELS = [
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron Super｜穩定快速（推薦）' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron Ultra｜文筆最好，較慢' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B｜尖峰時段可能忙碌' },
  { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B｜尖峰時段可能忙碌' },
];
const DEFAULT_MODEL = FREE_MODELS[0].id;
const MAX_TOKENS_CAP = 4000; // 免費模型會先思考再回答，額度要留足

const PAGE = String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>情緒價值客服轉譯器</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{
  --cloud:#EDF1F6; --paper:#FFFFFF; --ink:#1E2633; --mute:#5F6B80;
  --line:#D6DDE8; --rose:#C9506C; --rose-soft:#F7E3E8; --bubble:#E4F6E9; --go:#06C755;
}
@media (prefers-color-scheme: dark){
  :root{ --cloud:#151A22; --paper:#1E2530; --ink:#E8ECF2; --mute:#9AA6B8;
    --line:#2F3846; --rose:#EE8AA2; --rose-soft:#3A2630; --bubble:#1F3A2A; --go:#2BD46F; }
}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--cloud);color:var(--ink);font:16px/1.7 "Noto Sans TC",system-ui,sans-serif;}
main{max-width:640px;margin:0 auto;padding:32px 16px 64px}
h1{font:700 30px/1.25 "LXGW WenKai TC",serif;margin:0 0 6px;letter-spacing:.02em}
.lead{color:var(--mute);margin:0 0 28px}
form{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:20px}
label.field{display:block;font-weight:500;margin:0 0 6px}
.hint{color:var(--mute);font-weight:400;font-size:14px}
textarea{width:100%;font:inherit;color:var(--ink);background:var(--cloud);border:1px solid var(--line);border-radius:12px;padding:10px 12px;resize:vertical;min-height:84px;margin-bottom:18px}
textarea:focus,button:focus-visible,.chip input:focus-visible+span{outline:3px solid var(--rose);outline-offset:2px}
fieldset{border:0;padding:0;margin:0 0 18px}
legend{font-weight:500;margin-bottom:8px;padding:0}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip input{position:absolute;opacity:0;pointer-events:none}
.chip span{display:inline-block;padding:6px 14px;border:1px solid var(--line);border-radius:999px;cursor:pointer;font-size:15px;background:var(--paper)}
.chip input:checked+span{background:var(--rose-soft);border-color:var(--rose);color:var(--rose);font-weight:500}
.go{width:100%;border:0;border-radius:12px;padding:14px;font:700 17px "Noto Sans TC",sans-serif;background:var(--rose);color:#fff;cursor:pointer}
.go:disabled{opacity:.6;cursor:progress}
#out{margin-top:28px}
.status{color:var(--mute);text-align:center}
.err{background:var(--rose-soft);color:var(--ink);border-left:4px solid var(--rose);border-radius:10px;padding:12px 14px}
.reply{display:flex;flex-direction:column;align-items:flex-end;margin-bottom:22px}
.reply .tag{font-size:13px;color:var(--mute);margin:0 6px 4px}
.bubble{background:var(--bubble);border-radius:20px 20px 6px 20px;padding:14px 18px;max-width:92%;white-space:pre-wrap;font:19px/1.75 "LXGW WenKai TC",serif}
.copy{margin-top:6px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;padding:4px 14px;font:500 14px "Noto Sans TC",sans-serif;cursor:pointer}
.copy.done{border-color:var(--go);color:var(--go)}
select{width:100%;font:inherit;color:var(--ink);background:var(--cloud);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:18px}
select:focus{outline:3px solid var(--rose);outline-offset:2px}
.via{text-align:center;color:var(--mute);font-size:13px;margin:-8px 0 0}
.padlink{text-align:center;margin:28px 0 0}
.padlink a{color:var(--rose);font-weight:500}
__VER_CSS__
@media (prefers-reduced-motion: no-preference){ .reply{animation:pop .35s ease-out both} @keyframes pop{from{opacity:0;transform:translateY(8px)}} }
</style>
</head>
<body>
<main>
  <h1>情緒價值客服轉譯器</h1>
  <p class="lead">把你想說的意思打進來，幫你轉成讓客人聽了舒服的回覆，直接複製貼到 LINE。</p>

  <form id="f">
    <label class="field" for="customer">客人說了什麼 <span class="hint">（可不填）</span></label>
    <textarea id="customer" placeholder="例如：我上次做完臉有點紅，是不是你們產品有問題？"></textarea>

    <label class="field" for="intent">你想回的意思</label>
    <textarea id="intent" required placeholder="例如：產品沒問題，是肌膚比較敏感，下次幫她換溫和的，這次送一次舒緩保養"></textarea>

    <fieldset>
      <legend>情境</legend>
      <div class="chips" id="scene">
        <label class="chip"><input type="radio" name="scene" value="一般詢問回覆" checked><span>一般詢問</span></label>
        <label class="chip"><input type="radio" name="scene" value="客訴安撫與道歉"><span>客訴安撫</span></label>
        <label class="chip"><input type="radio" name="scene" value="婉拒客人的要求"><span>婉拒要求</span></label>
        <label class="chip"><input type="radio" name="scene" value="預約確認或提醒"><span>預約提醒</span></label>
        <label class="chip"><input type="radio" name="scene" value="價格或付款說明"><span>價格說明</span></label>
        <label class="chip"><input type="radio" name="scene" value="感謝與回訪關心"><span>感謝回訪</span></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>語氣</legend>
      <div class="chips">
        <label class="chip"><input type="radio" name="tone" value="溫暖親切，像熟客朋友" checked><span>溫暖親切</span></label>
        <label class="chip"><input type="radio" name="tone" value="專業穩重，有禮有分寸"><span>專業穩重</span></label>
        <label class="chip"><input type="radio" name="tone" value="活潑可愛，可以適度用表情符號"><span>活潑可愛</span></label>
      </div>
    </fieldset>

    <label class="field" for="model">AI 模型 <span class="hint">（全部免費，忙碌時會自動換下一個）</span></label>
    <select id="model">__MODEL_OPTIONS__</select>

    <button class="go" id="go" type="submit">轉成暖心回覆</button>
  </form>

  <section id="out" aria-live="polite"></section>
  <p class="padlink"><a href="/pad">打字時想要即時建議？開啟「客服草稿窗」→</a></p>
  __VERSION_INFO__
</main>

<script>
(function(){
  var f = document.getElementById('f');
  var out = document.getElementById('out');
  var btn = document.getElementById('go');
  var modelInput = document.getElementById('model');
  try { var saved = localStorage.getItem('jev-model'); if (saved && modelInput.querySelector('option[value="' + saved + '"]')) modelInput.value = saved; } catch(e) {}

  function val(name){ var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function parseReplies(text){
    var t = String(text || '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a !== -1 && b > a) {
      try { var j = JSON.parse(t.slice(a, b + 1)); if (j && Array.isArray(j.replies)) return j.replies.filter(Boolean); } catch(e) {}
    }
    var parts = t.split(/\n?={3,}\n?/).map(function(s){ return s.trim(); }).filter(Boolean);
    return parts.length ? parts : [t];
  }

  function render(replies, via){
    var tags = ['版本一', '版本二', '版本三', '版本四'];
    out.innerHTML = replies.map(function(r, i){
      return '<div class="reply"><div class="tag">' + (tags[i] || '版本') + '</div><div class="bubble">' + esc(r) +
        '</div><button type="button" class="copy" data-i="' + i + '">複製這則</button></div>';
    }).join('') + (via ? '<p class="via">由 ' + esc(via) + ' 產生</p>' : '');
    out.querySelectorAll('.copy').forEach(function(b){
      b.addEventListener('click', function(){
        var text = replies[+b.dataset.i];
        var ok = function(){ b.textContent = '已複製'; b.classList.add('done'); setTimeout(function(){ b.textContent = '複製這則'; b.classList.remove('done'); }, 1600); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function(){ fallback(text); ok(); });
        else { fallback(text); ok(); }
      });
    });
  }
  function fallback(text){ var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(e) {} ta.remove(); }

  f.addEventListener('submit', function(ev){
    ev.preventDefault();
    var intent = document.getElementById('intent').value.trim();
    var customer = document.getElementById('customer').value.trim();
    if (!intent) { out.innerHTML = '<p class="err">請先在「你想回的意思」打上你要表達的內容。</p>'; return; }
    var model = modelInput.value;
    try { localStorage.setItem('jev-model', model); } catch(e) {}

    var sys = '你是台灣美容 SPA 店的資深客服，專長是「情緒價值」溝通：先接住客人的情緒，再清楚表達店家的立場或資訊，讓客人感到被重視。' +
      '請用台灣慣用的繁體中文口語，適合直接貼到 LINE。不要捏造店家沒說過的承諾、時間、價格或優惠，只能潤飾使用者提供的意思。' +
      '三個版本都必須是各自完整、可以單獨傳送的一則回覆，每則回覆 2 到 5 句，不要加稱謂佔位符號（例如【姓名】）。' +
      '一律使用繁體中文，不可出現簡體字。請只輸出 JSON，格式為 {"replies":["版本一","版本二","版本三"]}，三個版本要有明顯不同的寫法。';
    var user = '情境：' + val('scene') + '\n語氣：' + val('tone') + '\n' +
      (customer ? '客人說：' + customer + '\n' : '') + '我想回的意思：' + intent;

    btn.disabled = true; btn.textContent = '轉譯中…';
    out.innerHTML = '<p class="status">正在幫你想三種說法…</p>';

    fetch(location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model, temperature: 0.7, max_tokens: 3000,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] })
    }).then(function(r){ return r.json().catch(function(){ return { error: '伺服器回傳格式錯誤（HTTP ' + r.status + '）' }; }); })
      .then(function(d){
        if (d && d.error) {
          var msg = typeof d.error === 'string' ? d.error : (d.error.message || JSON.stringify(d.error));
          throw new Error(msg);
        }
        var text = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (!text) throw new Error('模型這次沒有產出回覆（可能忙碌或想太久），請再按一次，或換一個模型試試。');
        render(parseReplies(text), d.model);
      })
      .catch(function(e){ out.innerHTML = '<p class="err">轉譯失敗：' + esc(e.message) + '</p>'; })
      .then(function(){ btn.disabled = false; btn.textContent = '轉成暖心回覆'; });
  });
})();
</script>
</body>
</html>`;

// 兩個頁面共用的版本資訊樣式與區塊
const VER_CSS = '.ver{margin:32px 0 0;color:var(--mute);font-size:13px;text-align:center}' +
  '.ver summary{cursor:pointer;display:inline-block}' +
  '.ver .box{text-align:left;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin-top:8px}' +
  '.ver h3{font-size:13px;margin:8px 0 2px;color:var(--ink)} .ver ul{margin:0;padding-left:18px}';
function versionInfoHtml() {
  const e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return '<details class="ver"><summary>版本資訊 v' + VERSION + '</summary><div class="box">' +
    CHANGELOG.map(c => '<h3>v' + c.v + '（' + c.date + '）</h3><ul>' + c.notes.map(n => '<li>' + e(n) + '</li>').join('') + '</ul>').join('') +
    '</div></details>';
}

// ── 客服草稿窗 ──
const PAD_PAGE = String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>客服草稿窗</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{
  --cloud:#EDF1F6; --paper:#FFFFFF; --ink:#1E2633; --mute:#5F6B80;
  --line:#D6DDE8; --rose:#C9506C; --rose-soft:#F7E3E8; --bubble:#E4F6E9; --go:#06C755;
  --amber:#B7791F; --amber-soft:#FCEFD9; --good:#1F8A4C; --good-soft:#DFF3E6;
}
@media (prefers-color-scheme: dark){
  :root{ --cloud:#151A22; --paper:#1E2530; --ink:#E8ECF2; --mute:#9AA6B8;
    --line:#2F3846; --rose:#EE8AA2; --rose-soft:#3A2630; --bubble:#1F3A2A; --go:#2BD46F;
    --amber:#F0B45A; --amber-soft:#3A3020; --good:#4FD08A; --good-soft:#1C3527; }
}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--cloud);color:var(--ink);font:15px/1.65 "Noto Sans TC",system-ui,sans-serif;}
main{max-width:560px;margin:0 auto;padding:14px 12px 40px}
header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
h1{font:700 20px/1.3 "LXGW WenKai TC",serif;margin:0}
.state{font-size:13px;color:var(--mute);display:flex;align-items:center;gap:6px;white-space:nowrap}
.dot{width:8px;height:8px;border-radius:50%;background:var(--line);flex:none}
.state.busy .dot{background:var(--amber)} .state.ok .dot{background:var(--go)} .state.bad .dot{background:var(--rose)}
@media (prefers-reduced-motion: no-preference){ .state.busy .dot{animation:blink 1s infinite} @keyframes blink{50%{opacity:.25}} }
.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:12px}
details.cust summary{cursor:pointer;font-weight:500;font-size:14px;color:var(--mute)}
details.cust[open] summary{margin-bottom:6px}
textarea{width:100%;font:inherit;color:var(--ink);background:var(--cloud);border:1px solid var(--line);border-radius:10px;padding:8px 10px;resize:vertical}
#customer{min-height:60px}
#draft{min-height:120px;font-size:16px;margin-top:10px}
textarea:focus,button:focus-visible,select:focus,input:focus-visible{outline:3px solid var(--rose);outline-offset:2px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
.row select{flex:1 1 140px;font:inherit;font-size:14px;color:var(--ink);background:var(--cloud);border:1px solid var(--line);border-radius:10px;padding:6px 8px;min-width:0}
.auto{font-size:14px;display:flex;align-items:center;gap:4px;color:var(--mute)}
.btn{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;padding:5px 14px;font:500 14px "Noto Sans TC",sans-serif;cursor:pointer}
.btn.main{background:var(--rose);border-color:var(--rose);color:#fff}
.btn.done{border-color:var(--go);color:var(--go)}
.note{font-size:12px;color:var(--mute);margin:6px 2px 0}
#out{margin-top:12px;transition:opacity .2s}
#out.stale{opacity:.5}
.empty{color:var(--mute);text-align:center;font-size:14px;padding:18px 8px}
.err{background:var(--rose-soft);border-left:4px solid var(--rose);border-radius:10px;padding:10px 12px;font-size:14px}
.head{display:flex;gap:12px;align-items:center}
.score{flex:none;width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font:700 22px/1 "Noto Sans TC",sans-serif}
.score small{display:block;font-size:10px;font-weight:500;margin-top:2px}
.s-good{background:var(--good-soft);color:var(--good)} .s-mid{background:var(--amber-soft);color:var(--amber)} .s-bad{background:var(--rose-soft);color:var(--rose)}
.verdict{font-weight:500}
h2{font-size:13px;color:var(--mute);margin:14px 0 6px;font-weight:500}
ul.issues,ul.ask{list-style:none;margin:0;padding:0;display:grid;gap:6px}
ul.issues li{display:flex;gap:8px;align-items:flex-start}
.tag{flex:none;font-size:12px;border-radius:6px;padding:1px 7px;margin-top:2px;background:var(--amber-soft);color:var(--amber);font-weight:500}
.tag.t-risk{background:var(--rose-soft);color:var(--rose)}
ul.ask li::before{content:"？ ";color:var(--rose);font-weight:700}
.bubble{background:var(--bubble);border-radius:16px 16px 6px 16px;padding:10px 14px;white-space:pre-wrap;font:17px/1.7 "LXGW WenKai TC",serif}
.okmsg{color:var(--good);font-weight:500}
.via{color:var(--mute);font-size:12px;text-align:right;margin:8px 0 0}
.back{text-align:center;font-size:13px;margin:22px 0 0} .back a{color:var(--rose)}
__VER_CSS__
</style>
</head>
<body>
<main>
  <header>
    <h1>客服草稿窗</h1>
    <div class="state" id="state" aria-live="polite"><span class="dot"></span><span id="stateText">待命</span></div>
  </header>

  <div class="card">
    <details class="cust" id="custBox">
      <summary>客人說了什麼（貼上會檢查得更準）</summary>
      <textarea id="customer" placeholder="把客人的訊息貼在這裡"></textarea>
    </details>
    <textarea id="draft" placeholder="在這裡打你要回客人的話，停下來約 1.5 秒就會自動檢查邏輯" aria-label="客服回覆草稿"></textarea>
    <div class="row">
      <button class="btn main" id="copyDraft" type="button" title="Ctrl + Enter">複製草稿</button>
      <button class="btn" id="checkNow" type="button">立即檢查</button>
      <button class="btn" id="clearAll" type="button">換下一位客人</button>
    </div>
    <div class="row">
      <label class="auto"><input type="checkbox" id="auto" checked> 停頓自動檢查</label>
      <select id="model" aria-label="AI 模型">__MODEL_OPTIONS__</select>
    </div>
    <p class="note" id="maskNote">電話、Email、長串號碼會先遮蔽再送給 AI。快捷鍵：Ctrl + Enter 複製草稿。</p>
  </div>

  <section id="out" aria-live="polite"><p class="empty">開始打字後，這裡會出現邏輯建議。</p></section>

  <p class="back"><a href="/">回到情緒價值轉譯器</a></p>
  __VERSION_INFO__
</main>

<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var draft = $('draft'), customer = $('customer'), out = $('out'), modelSel = $('model'), autoBox = $('auto');
  var state = $('state'), stateText = $('stateText');
  var DELAY = 1500, MIN_LEN = 6;
  var timer = null, ctrl = null, lastKey = '', pausedUntil = 0, seq = 0;

  function load(k){ try { return localStorage.getItem(k); } catch(e) { return null; } }
  function save(k, v){ try { localStorage.setItem(k, v); } catch(e) {} }
  var m = load('jev-model'); if (m && modelSel.querySelector('option[value="' + m + '"]')) modelSel.value = m;
  if (load('jev-pad-auto') === '0') autoBox.checked = false;
  modelSel.addEventListener('change', function(){ save('jev-model', modelSel.value); lastKey = ''; });
  autoBox.addEventListener('change', function(){ save('jev-pad-auto', autoBox.checked ? '1' : '0'); if (autoBox.checked) schedule(); });

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function setState(cls, text){ state.className = 'state ' + cls; stateText.textContent = text; }

  // 送出前遮蔽個資
  function mask(t){
    var n = 0;
    t = String(t)
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, function(){ n++; return '[Email]'; })
      .replace(/(\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, function(){ n++; return '[電話]'; })
      .replace(/\(?0\d{1,2}\)?[-\s]?\d{3,4}[-\s]?\d{4}/g, function(){ n++; return '[電話]'; })
      .replace(/\d{8,}/g, function(){ n++; return '[號碼]'; });
    return { text: t, count: n };
  }

  function copyText(text, btn, label){
    var ok = function(){ if (!btn) return; btn.textContent = '已複製'; btn.classList.add('done'); setTimeout(function(){ btn.textContent = label; btn.classList.remove('done'); }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function(){ fallback(text); ok(); });
    else { fallback(text); ok(); }
  }
  function fallback(text){ var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(e) {} ta.remove(); }

  function schedule(){
    clearTimeout(timer);
    var d = draft.value.trim();
    if (!d) { setState('', '待命'); return; }
    if (d.length < MIN_LEN) { setState('', '繼續打字…'); return; }
    if (!autoBox.checked) { setState('', '自動檢查已關閉'); return; }
    if (Date.now() < pausedUntil) { setState('bad', '模型忙碌，稍後再試'); return; }
    out.classList.add('stale');
    setState('', '等你停下來…');
    timer = setTimeout(function(){ check(false); }, DELAY);
  }

  function check(force){
    clearTimeout(timer);
    var d = draft.value.trim();
    if (d.length < MIN_LEN) { out.innerHTML = '<p class="empty">草稿再多打幾個字就能檢查。</p>'; return; }
    var c = mask(customer.value.trim()), dm = mask(d);
    var key = modelSel.value + '|' + c.text + '|' + dm.text;
    if (!force && key === lastKey) { out.classList.remove('stale'); setState('ok', '已是最新建議'); return; }
    lastKey = key;
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    var my = ++seq;
    var masked = c.count + dm.count;
    $('maskNote').textContent = masked ? '這次已遮蔽 ' + masked + ' 筆個資再送出；建議版中的 [電話] 等請自行換回。' : '電話、Email、長串號碼會先遮蔽再送給 AI。快捷鍵：Ctrl + Enter 複製草稿。';
    setState('busy', '分析中…');
    out.classList.add('stale');

    fetch('/api/review', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelSel.value, customer: c.text, draft: dm.text })
    }).then(function(r){ return r.json().catch(function(){ return { error: '伺服器回傳格式錯誤（HTTP ' + r.status + '）' }; }).then(function(j){ j._status = r.status; return j; }); })
      .then(function(d){
        if (my !== seq) return;
        if (d.error) {
          if (d._status === 429) pausedUntil = Date.now() + 20000;
          lastKey = '';
          throw new Error(d.error);
        }
        render(d);
        setState('ok', '已更新');
      })
      .catch(function(e){
        if (e.name === 'AbortError' || my !== seq) return;
        out.classList.remove('stale');
        out.innerHTML = '<p class="err">檢查失敗：' + esc(e.message) + '</p>';
        setState('bad', '檢查失敗');
      });
  }

  function render(d){
    var r = d.review || {};
    out.classList.remove('stale');
    if (!d.review) {
      out.innerHTML = '<div class="card"><h2>AI 原始回覆（格式沒對上，僅供參考）</h2><div class="bubble">' + esc(d.raw || '') + '</div></div>';
      return;
    }
    var score = Math.max(1, Math.min(10, Math.round(Number(r.score) || 0))) || '-';
    var cls = score >= 8 ? 's-good' : score >= 5 ? 's-mid' : 's-bad';
    var h = '<div class="card"><div class="head"><div class="score ' + cls + '">' + score + '<small>/10</small></div>' +
      '<div class="verdict">' + esc(r.verdict || '') + '</div></div>';
    var issues = Array.isArray(r.issues) ? r.issues : [];
    if (issues.length) {
      h += '<h2>要注意的地方</h2><ul class="issues">' + issues.map(function(it){
        var type = it && it.type ? String(it.type) : '提醒';
        var risk = /承諾|風險|誤會/.test(type) ? ' t-risk' : '';
        return '<li><span class="tag' + risk + '">' + esc(type) + '</span><span>' + esc(it && it.text ? it.text : it) + '</span></li>';
      }).join('') + '</ul>';
    } else {
      h += '<p class="okmsg">邏輯沒有明顯問題，可以送出。</p>';
    }
    var ask = Array.isArray(r.ask) ? r.ask.filter(Boolean) : [];
    if (ask.length) h += '<h2>建議先問客人</h2><ul class="ask">' + ask.map(function(q){ return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>';
    if (r.rewrite) {
      h += '<h2>建議版本</h2><div class="bubble" id="rw"></div><div class="row">' +
        '<button class="btn main" type="button" id="copyRw">複製建議版</button>' +
        '<button class="btn" type="button" id="useRw">換成建議版</button></div>';
    }
    h += (d.model ? '<p class="via">由 ' + esc(d.model) + ' 檢查</p>' : '') + '</div>';
    out.innerHTML = h;
    if (r.rewrite) {
      $('rw').textContent = r.rewrite;
      $('copyRw').addEventListener('click', function(){ copyText(r.rewrite, this, '複製建議版'); });
      $('useRw').addEventListener('click', function(){ draft.value = r.rewrite; draft.focus(); schedule(); });
    }
  }

  draft.addEventListener('input', schedule);
  customer.addEventListener('input', function(){ if (draft.value.trim()) schedule(); });
  $('checkNow').addEventListener('click', function(){ check(true); });
  $('copyDraft').addEventListener('click', function(){ copyText(draft.value, this, '複製草稿'); });
  $('clearAll').addEventListener('click', function(){
    clearTimeout(timer); if (ctrl) ctrl.abort(); seq++; lastKey = '';
    draft.value = ''; customer.value = '';
    out.classList.remove('stale');
    out.innerHTML = '<p class="empty">開始打字後，這裡會出現邏輯建議。</p>';
    setState('', '待命'); draft.focus();
  });
  document.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); copyText(draft.value, $('copyDraft'), '複製草稿'); }
  });
  draft.focus();
})();
</script>
</body>
</html>`;

// ── 邏輯檢查的提示詞 ──
const REVIEW_SYSTEM = '你是台灣美容 SPA 店的客服主管，負責在客服把訊息送出前做「邏輯品質檢查」。重點是內容與邏輯，不是文字潤飾。' +
  '請檢查：1. 有沒有回應到客人真正的問題或需求（漏答、答非所問）；2. 承諾風險：沒經過確認就答應時間、退費、效果保證、優惠或例外；' +
  '3. 缺少的資訊，或應該先問客人的事；4. 前後矛盾、容易讓客人誤會或引起爭議的說法；5. 語氣：冷淡、推卸責任、命令口吻、讓客人覺得被指責；6. 錯字或簡體字。' +
  '規則：不要捏造店家沒說過的資訊；issues 最多 5 條，每條一句話，具體指出是哪一句、該怎麼改；草稿已經很好就給空陣列，不要硬挑毛病。' +
  'rewrite 是修正後、可以直接貼到 LINE 的完整回覆，保留客服原本的意思與立場，不新增任何承諾；草稿已經很好時 rewrite 給空字串；' +
  '草稿看起來還沒打完（句子明顯中斷）時，只針對已寫的部分給 issues，rewrite 給空字串。文字中的 [電話]、[Email]、[號碼] 是遮蔽過的個資，原樣保留。' +
  '一律使用台灣繁體中文。只輸出 JSON，不要其他文字，格式：' +
  '{"score":1到10的整數,"verdict":"一句話總評","issues":[{"type":"漏答|承諾風險|缺資訊|易誤會|語氣|錯字","text":"具體建議"}],"ask":["建議先問客人的問題"],"rewrite":"建議版本或空字串"}';

const MAX_INPUT_CHARS = 1500;

// 伺服器端再遮一次個資（前端已遮，這裡是保險）
function maskPII(t) {
  return String(t || '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[Email]')
    .replace(/(\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, '[電話]')
    .replace(/\(?0\d{1,2}\)?[-\s]?\d{3,4}[-\s]?\d{4}/g, '[電話]')
    .replace(/\d{8,}/g, '[號碼]');
}

function parseReview(text) {
  const t = String(text || '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try {
    const j = JSON.parse(t.slice(a, b + 1));
    if (!j || typeof j !== 'object') return null;
    const issues = (Array.isArray(j.issues) ? j.issues : []).slice(0, 5).map(it =>
      typeof it === 'string' ? { type: '提醒', text: it } : { type: String(it.type || '提醒'), text: String(it.text || '') }
    ).filter(it => it.text);
    return {
      score: Math.max(1, Math.min(10, Math.round(Number(j.score) || 5))),
      verdict: String(j.verdict || ''),
      issues,
      ask: (Array.isArray(j.ask) ? j.ask : []).map(String).filter(Boolean).slice(0, 3),
      rewrite: typeof j.rewrite === 'string' ? j.rewrite.trim() : '',
    };
  } catch {
    return null;
  }
}

// 只接受 :free 模型；不合規就改用預設
function pickModel(requested, env) {
  if (typeof requested === 'string' && requested.endsWith(':free')) return requested;
  const d = env && env.DEFAULT_MODEL;
  return typeof d === 'string' && d.endsWith(':free') ? d : DEFAULT_MODEL;
}
function fallbackList(first) {
  return [first, ...FREE_MODELS.map(m => m.id).filter(id => id !== first)].slice(0, 3);
}

async function callOpenRouter(apiKey, payload) {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://emotion-translator.app',
      // HTTP header 只能放 ASCII，中文會讓 fetch 直接丟錯
      'X-Title': 'Emotion JEV Translator',
    },
    body: JSON.stringify({
      // 選定的模型排第一，其餘免費模型當備援（遇到忙碌 429 時 OpenRouter 會自動改用下一個）
      models: fallbackList(payload.model),
      messages: payload.messages,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      // 精簡思考、不回傳思考內容，避免額度被思考用光導致回覆空白
      reasoning: { effort: 'low', exclude: true },
    }),
  });
}

function renderPage(tpl) {
  const options = FREE_MODELS.map(m => '<option value="' + m.id + '">' + m.label + '</option>').join('');
  return tpl.replace('__MODEL_OPTIONS__', options).replace('__VER_CSS__', VER_CSS).replace('__VERSION_INFO__', versionInfoHtml());
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    const html = page => new Response(renderPage(page), { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method === 'GET') {
      if (path === '/health') {
        return json({ ok: true, version: VERSION, hasKey: Boolean(env.OPENROUTER_API_KEY), defaultModel: pickModel(env.DEFAULT_MODEL, env), models: FREE_MODELS });
      }
      if (path === '/pad') return html(PAD_PAGE);
      return html(PAGE);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body 不是合法 JSON' }, 400);
    }
    if (!body || typeof body !== 'object') {
      return json({ error: 'Body 必須是 JSON 物件' }, 400);
    }

    // 模式 A：Key 放 Worker 環境變數（優先）；模式 B：前端傳 apiKey
    const apiKey = env.OPENROUTER_API_KEY || body.apiKey;
    if (!apiKey) {
      return json({ error: '尚未設定 API Key：請到 Cloudflare 的 Worker 設定 OPENROUTER_API_KEY' }, 400);
    }

    // ── 客服草稿邏輯檢查 ──
    if (path === '/api/review') {
      const draft = maskPII(String(body.draft || '').trim()).slice(0, MAX_INPUT_CHARS);
      const customer = maskPII(String(body.customer || '').trim()).slice(0, MAX_INPUT_CHARS);
      if (!draft) return json({ error: '草稿是空的' }, 400);
      const user = (customer ? '客人說：\n' + customer + '\n\n' : '（沒有提供客人訊息，請依草稿本身判斷）\n\n') + '客服草稿：\n' + draft;
      try {
        const res = await callOpenRouter(apiKey, {
          model: pickModel(body.model, env),
          temperature: 0.2,
          max_tokens: 2500,
          messages: [{ role: 'system', content: REVIEW_SYSTEM }, { role: 'user', content: user }],
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          const msg = data && data.error ? (data.error.message || JSON.stringify(data.error)) : 'AI 服務回應錯誤';
          return json({ error: res.status === 429 ? '免費模型目前忙碌，約 20 秒後再試' : msg }, res.status === 429 ? 429 : 502);
        }
        const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!text) return json({ error: '模型這次沒有產出建議，請按「立即檢查」再試一次，或換一個模型' }, 502);
        const review = parseReview(text);
        return json(review ? { review, model: data.model } : { review: null, raw: text, model: data.model });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ── 通用代理（轉譯器頁面與其他前端使用）──
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: 'messages 必須是非空陣列' }, 400);
    }

    try {
      const res = await callOpenRouter(apiKey, {
        model: pickModel(body.model, env),
        messages: body.messages,
        temperature: body.temperature ?? 0.3,
        max_tokens: Math.min(Number(body.max_tokens) || 3000, MAX_TOKENS_CAP),
      });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};
