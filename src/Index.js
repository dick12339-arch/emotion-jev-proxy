export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Use POST - Emotion JEV Proxy is running', { status: 200, headers: cors });
    }
    try {
      const body = await request.json();
      // 支援兩種模式：A. Key 藏在 Worker 環境變數, B. 前端傳來
      const apiKey = body.apiKey || env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'No API key - set OPENROUTER_API_KEY in Cloudflare Variables' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://emotion-translator.app',
          'X-Title': '情緒價值客服轉譯器',
        },
        body: JSON.stringify({
          model: body.model || 'google/gemini-2.0-flash-exp:free',
          messages: body.messages,
          temperature: body.temperature ?? 0.3,
          max_tokens: body.max_tokens ?? 800,
        }),
      });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  },
};
