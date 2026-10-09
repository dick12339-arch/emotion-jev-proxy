export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Use POST - Emotion JEV Proxy is running', { status: 200, headers: cors });
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
      return json({ error: 'No API key - set OPENROUTER_API_KEY in Cloudflare Variables' }, 400);
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
          model: body.model || env.DEFAULT_MODEL || 'openrouter/auto',
          messages: body.messages,
          temperature: body.temperature ?? 0.3,
          max_tokens: body.max_tokens ?? 800,
        }),
      });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};
