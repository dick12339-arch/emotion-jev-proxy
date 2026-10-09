// Emotion JEV Proxy — 情緒價值客服轉譯器
// GET  /  → 轉譯器操作頁面（打開網址就能用）
// POST /  → 轉送到 OpenRouter（Key 優先使用 Cloudflare 環境變數 OPENROUTER_API_KEY）

const DEFAULT_MODEL = 'openrouter/auto';
const MAX_TOKENS_CAP = 1500;

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
details{margin-top:18px;color:var(--mute);font-size:14px}
details input{width:100%;font:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--cloud);color:var(--ink);margin-top:6px}
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

    <button class="go" id="go" type="submit">轉成暖心回覆</button>

    <details>
      <summary>進階設定</summary>
      <label for="model">指定模型 ID（留空使用預設）</label>
      <input id="model" placeholder="例如 google/gemini-2.5-flash">
    </details>
  </form>

  <section id="out" aria-live="polite"></section>
</main>

<script>
(function(){
  var f = document.getElementById('f');
  var out = document.getElementById('out');
  var btn = document.getElementById('go');
  var modelInput = document.getElementById('model');
  try { modelInput.value = localStorage.getItem('jev-model') || ''; } catch(e) {}

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

  function render(replies){
    var tags = ['版本一', '版本二', '版本三', '版本四'];
    out.innerHTML = replies.map(function(r, i){
      return '<div class="reply"><div class="tag">' + (tags[i] || '版本') + '</div><div class="bubble">' + esc(r) +
        '</div><button type="button" class="copy" data-i="' + i + '">複製這則</button></div>';
    }).join('');
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
    var model = modelInput.value.trim();
    try { localStorage.setItem('jev-model', model); } catch(e) {}

    var sys = '你是台灣美容 SPA 店的資深客服，專長是「情緒價值」溝通：先接住客人的情緒，再清楚表達店家的立場或資訊，讓客人感到被重視。' +
      '請用台灣慣用的繁體中文口語，適合直接貼到 LINE。不要捏造店家沒說過的承諾、價格或優惠，只能潤飾使用者提供的意思。' +
      '每則回覆 2 到 5 句，不要加稱謂佔位符號（例如【姓名】）。' +
      '請只輸出 JSON，格式為 {"replies":["版本一","版本二","版本三"]}，三個版本要有明顯不同的寫法。';
    var user = '情境：' + val('scene') + '\n語氣：' + val('tone') + '\n' +
      (customer ? '客人說：' + customer + '\n' : '') + '我想回的意思：' + intent;

    btn.disabled = true; btn.textContent = '轉譯中…';
    out.innerHTML = '<p class="status">正在幫你想三種說法…</p>';

    fetch(location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || undefined, temperature: 0.7, max_tokens: 900,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] })
    }).then(function(r){ return r.json().catch(function(){ return { error: '伺服器回傳格式錯誤（HTTP ' + r.status + '）' }; }); })
      .then(function(d){
        if (d && d.error) {
          var msg = typeof d.error === 'string' ? d.error : (d.error.message || JSON.stringify(d.error));
          throw new Error(msg);
        }
        var text = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (!text) throw new Error('模型沒有回傳內容，請再按一次，或在進階設定換一個模型。');
        render(parseReplies(text));
      })
      .catch(function(e){ out.innerHTML = '<p class="err">轉譯失敗：' + esc(e.message) + '</p>'; })
      .then(function(){ btn.disabled = false; btn.textContent = '轉成暖心回覆'; });
  });
})();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return json({ ok: true, hasKey: Boolean(env.OPENROUTER_API_KEY), model: env.DEFAULT_MODEL || DEFAULT_MODEL });
      }
      return new Response(PAGE, { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } });
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

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: 'messages 必須是非空陣列' }, 400);
    }

    // 模式 A：Key 放 Worker 環境變數（優先）；模式 B：前端傳 apiKey
    const apiKey = env.OPENROUTER_API_KEY || body.apiKey;
    if (!apiKey) {
      return json({ error: '尚未設定 API Key：請到 Cloudflare 的 Worker 設定 OPENROUTER_API_KEY' }, 400);
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://emotion-translator.app',
          // HTTP header 只能放 ASCII，中文會讓 fetch 直接丟錯
          'X-Title': 'Emotion JEV Translator',
        },
        body: JSON.stringify({
          model: body.model || env.DEFAULT_MODEL || DEFAULT_MODEL,
          messages: body.messages,
          temperature: body.temperature ?? 0.3,
          max_tokens: Math.min(Number(body.max_tokens) || 800, MAX_TOKENS_CAP),
        }),
      });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};
