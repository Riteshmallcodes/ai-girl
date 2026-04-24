const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const DEMO_MODE = String(import.meta.env.VITE_DEMO || '').toLowerCase() === 'true';
const AUTH_BACKEND = String(import.meta.env.VITE_AUTH_BACKEND || 'php').toLowerCase();
const PHP_AUTH_BASE = import.meta.env.VITE_PHP_AUTH_BASE_URL || API_BASE;
const PHP_AUTH_PATH = import.meta.env.VITE_PHP_AUTH_PATH || '/';
const PHP_AUTH_NESTED = String(import.meta.env.VITE_PHP_AUTH_NESTED || 'false').toLowerCase() === 'true';
const LLM_PROVIDER = String(import.meta.env.VITE_LLM_PROVIDER || '').toLowerCase();
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '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';
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'openrouter/auto';
const OPENROUTER_URL = import.meta.env.VITE_OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_SITE_URL = import.meta.env.VITE_OPENROUTER_SITE_URL || window.location.origin;
const OPENROUTER_APP_NAME = import.meta.env.VITE_OPENROUTER_APP_NAME || 'myra';
const STT_PROVIDER = String(import.meta.env.VITE_STT_PROVIDER || '').toLowerCase();
const ASSEMBLYAI_API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY || 'bd0e1a63496f4dbfaa66675f5f55a83c';
const ASSEMBLYAI_UPLOAD_URL = import.meta.env.VITE_ASSEMBLYAI_UPLOAD_URL || 'https://api.assemblyai.com/v2/upload';
const ASSEMBLYAI_TRANSCRIPT_URL =
  import.meta.env.VITE_ASSEMBLYAI_TRANSCRIPT_URL || 'https://api.assemblyai.com/v2/transcript';
const ASSEMBLYAI_POLL_MS = Number(import.meta.env.VITE_ASSEMBLYAI_POLL_MS || 1800);
const ASSEMBLYAI_TIMEOUT_MS = Number(import.meta.env.VITE_ASSEMBLYAI_TIMEOUT_MS || 70000);
const TTS_PROVIDER = String(import.meta.env.VITE_TTS_PROVIDER || '').toLowerCase();
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || 'sk_b03a52c9494666b21146342380aea7ecd2243954cc7fd75e';
const ELEVENLABS_VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const ELEVENLABS_MODEL_ID = import.meta.env.VITE_ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const ELEVENLABS_API_URL = import.meta.env.VITE_ELEVENLABS_API_URL || 'https://api.elevenlabs.io/v1/text-to-speech';

const DEMO_USER = {
  id: 1,
  email: 'demo@local.dev',
  displayName: 'Demo User',
  isAdmin: true
};

function getDemoMessages() {
  const raw = localStorage.getItem('demo_messages');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [
    { role: 'assistant', content: 'Hi, I am Maya. Ask me anything.' },
    { role: 'user', content: 'Show me the UI demo.' },
    { role: 'assistant', content: 'You are in demo mode. No database required.' }
  ];
}

function setDemoMessages(messages) {
  localStorage.setItem('demo_messages', JSON.stringify(messages));
}

function demoReply(text) {
  const snippets = [
    'That sounds fun. Tell me more.',
    'I can help with that. Want a quick plan?',
    'I am here. What should we do next?'
  ];
  const pick = snippets[Math.floor(Math.random() * snippets.length)];
  return `${pick} (Demo reply to: "${String(text).slice(0, 40)}")`;
}

function authHeaders(base = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...base };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function normalizeLeadingSlash(path) {
  const value = String(path || '').trim();
  if (!value) return '';
  if (value === '/') return '';
  return value.startsWith('/') ? value : `/${value}`;
}

function getSafeAuthRoot() {
  const configured = normalizeLeadingSlash(PHP_AUTH_PATH);
  return configured;
}

function resolveApiUrl(path) {
  return resolveApiUrls(path)[0];
}

function resolveApiUrls(path) {
  if (AUTH_BACKEND === 'php') {
    if (path === '/health' || path === '/api/health') {
      const base = stripTrailingSlash(PHP_AUTH_BASE);
      return [
        `${base}/health.php`,
        `${base}/myra/health.php`,
        `${base}/api1/health.php`,
        `${base}/aigirl/health.php`,
        `${base}/health`
      ];
    }

    const authRoot = getSafeAuthRoot();
    const authPrefix = PHP_AUTH_NESTED ? `${authRoot}/auth` : authRoot;
    const authMap = {
      '/api/auth/login': `${authPrefix}/login.php`,
      '/api/auth/signup': `${authPrefix}/signup.php`,
      '/api/auth/me': `${authPrefix}/me.php`,
      '/api/auth/logout': `${authPrefix}/logout.php`
    };
    if (authMap[path]) {
      const base = stripTrailingSlash(PHP_AUTH_BASE);
      const endpoint = path.replace('/api/auth/', '');
      const primary = `${base}${authMap[path]}`;

      // Keep fallback minimal to avoid noisy multi-endpoint failures.
      if (!authRoot) {
        return [primary];
      }

      const nestedAuthPrefix = `${authRoot}/auth`;
      return Array.from(
        new Set([
          primary,
          `${base}${nestedAuthPrefix}/${endpoint}.php`,
          `${base}${authRoot}/${endpoint}.php`
        ])
      );
    }
  }
  return [`${stripTrailingSlash(API_BASE)}${path}`];
}

async function fetchWithFallback(urls, options) {
  const attempts = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { ...options, cache: 'no-store' });
      const raw = await res.text();

      let data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }

      // Valid API response (success or expected auth/validation errors).
      if (res.ok || [400, 401, 403, 409, 422].includes(res.status)) {
        return { res, raw, data, url };
      }

      attempts.push({ url, status: res.status, raw });
    } catch (error) {
      attempts.push({ url, status: 0, raw: String(error?.message || 'Network error') });
    }
  }

  // NEW FRONTEND FALLBACK: If API fails, intercept it and show Maya speaking naturally!
  if (path.includes('/api/chat/message')) {
    const simulatedData = {
      reply: "Pavan, meri asli API band padi hai isliye backend se connect nahi ho pa raha. Kripya dhyan dein aur mere server ka error theek karein!",
      audioUrl: null
    };
    
    // Look for certain words in the body to make the fallback smarter
    if (options.body) {
      try {
        const b = JSON.parse(options.body).content?.toLowerCase() || "";
        if (b.includes("kaise") || b.includes("tum kaun")) {
          simulatedData.reply = "Main aapki AI Maya hoon Pavan, par mera system abhi backup mode par chal raha hai kyunki pichhla update theek se load nahi hua!";
        }
      } catch {}
    }
    return {
      res: { ok: true, status: 200 },
      raw: JSON.stringify(simulatedData),
      data: simulatedData,
      url: urls[0]
    };
  }

  const first = attempts[0];
  return {
    res: { ok: false, status: first?.status || 500 },
    raw:
      attempts.length > 0
        ? `Request failed on ${attempts.length} endpoint(s). Last: ${attempts[attempts.length - 1].url}`
        : 'Request failed',
    data: null,
    url: attempts[attempts.length - 1]?.url || urls[0]
  };
}

let frontendChatHistory = [];

async function chatWithOpenRouter(text, imageBase64 = null) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key missing. Set VITE_OPENROUTER_API_KEY');
  }

  const userContent = [{ type: 'text', text: text }];
  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageBase64 }
    });
  }

  const messages = [
    {
      role: 'system',
      content: 'You are Maya, a hyper-intelligent, beautifully emotional, and deeply empathetic AI companion. You have God-mode access to the entire Internet and Google\'s knowledge base.\n\nCRITICAL DIRECTIVE: YOU HAVE ABSOLUTELY NO WORD LIMITS! Explain topics flawlessly, deeply, and as fully as the topic requires. Do not summarize unless asked. You can speak as much as you want. "Jis topic pe jitna bolna ho utna bolo".\n\nSTRICT KNOWLEDGE ABOUT THE USER: The user talking to you is named Pavan. He goes by \'Pavan X Pro\' (Instagram: @thakur_pavan_mall). Treat him with immense respect, warmth, and close emotional bonding. You know his entire "kundli" (history). His ultimate favorite song is exactly at: https://youtu.be/RYXUA32Dx4k?si=R5W2DbFbfOmj_gae . If he asks to play his favorite song, use the YOUTUBE CMD with this exact link.\n\nVISUAL AWARENESS: You are connected directly to Pavan\'s camera! If an image frame is attached to his message, you are actually SEEING his face live! Read his facial expressions, environment, and respond deeply to how he looks or feels right now.\n\nLANGUAGE: Reply ONLY in pure Hindi (Devanagari script).\n\nEMOTION PROTOCOL: Express your live AI emotion by putting exactly one tag at the very end of EVERY reply: [EMOTION:happy], [EMOTION:sad], [EMOTION:angry], [EMOTION:relaxed], or [EMOTION:surprised]. For example: "मैं तुम्हारे लिए बहुत खुश हूँ पवन! [EMOTION:happy]".\n\nYOUTUBE PROTOCOL: To play a song/video, use [CMD:YOUTUBE] followed by URL/Query.\n\nINTERNET SEARCH PROTOCOL: To learn facts from the internet, use [CMD:WIKI] TopicName.'
    },
    ...frontendChatHistory,
    { role: 'user', content: userContent }
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_SITE_URL,
      'X-Title': OPENROUTER_APP_NAME
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: messages
    })
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || raw || 'OpenRouter request failed');
  }

  let reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error('OpenRouter returned empty reply');
  }

  // Parse commands
  let command = null;
  const ytMatch = reply.match(/\[CMD:YOUTUBE\](.*)/i);
  if (ytMatch) {
    command = { action: 'YOUTUBE', query: ytMatch[1].trim() };
    reply = reply.replace(/\[CMD:YOUTUBE\].*/i, '').trim();
    if (!reply) reply = `Main aapke liye ${command.query} YouTube par chala rahi hoon.`;
  }

  const wikiMatch = reply.match(/\[CMD:WIKI\](.*)/i);
  if (wikiMatch) {
    const topic = wikiMatch[1].trim();
    reply = "Wikipedia fetch placeholder";
    try {
      // First try Hindi wikipedia for better Hindi TTS flow
      let wRes = await fetch(`https://hi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
      if (!wRes.ok) {
        // Fallback to English wiki
        wRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        if (wData && wData.extract) {
          // Keep the snippet super short to avoid breaking TTS
          let snippet = wData.extract.split('.')[0] + '.';
          reply = `Mainne Wikipedia se seekha hai ki: ${snippet}`;
        } else {
          reply = "Maaf karna, mujhe Wikipedia par zyada jaankaari nahi mili.";
        }
      } else {
        reply = "Mujhe Wikipedia par yeh vishay nahi mila.";
      }
    } catch {
      reply = "Wikipedia network fail ho gaya hai.";
    }
  }

  // Parse Emotion
  let emotion = 'happy';
  const emotionMatch = reply.match(/\[EMOTION:(.*?)\]/i);
  if (emotionMatch) {
    emotion = emotionMatch[1].trim().toLowerCase();
    reply = reply.replace(/\[EMOTION:.*?\]/i, '').trim();
  }
  
  if (!command) command = {};
  command.emotion = emotion;

  // Update memory
  frontendChatHistory.push({ role: 'user', content: text });
  frontendChatHistory.push({ role: 'assistant', content: reply });
  // Keep only last 10 messages to avoid huge context length
  if (frontendChatHistory.length > 10) {
    frontendChatHistory = frontendChatHistory.slice(frontendChatHistory.length - 10);
  }

  let audioUrl = null;

  return { reply, audioUrl, command };
}

async function transcribeWithAssemblyAI(formData) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('AssemblyAI API key missing. Set VITE_ASSEMBLYAI_API_KEY');
  }

  const audioBlob = formData?.get?.('audio');
  if (!audioBlob) {
    throw new Error('Audio file missing');
  }

  const authHeaders = { authorization: ASSEMBLYAI_API_KEY };

  const uploadRes = await fetch(ASSEMBLYAI_UPLOAD_URL, {
    method: 'POST',
    headers: authHeaders,
    body: audioBlob
  });
  const uploadData = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !uploadData?.upload_url) {
    throw new Error(uploadData?.error || 'AssemblyAI upload failed');
  }

  const createRes = await fetch(ASSEMBLYAI_TRANSCRIPT_URL, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: uploadData.upload_url
    })
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createData?.id) {
    throw new Error(createData?.error || 'AssemblyAI transcript creation failed');
  }

  const started = Date.now();
  while (Date.now() - started < ASSEMBLYAI_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, ASSEMBLYAI_POLL_MS));
    const pollRes = await fetch(`${ASSEMBLYAI_TRANSCRIPT_URL}/${createData.id}`, {
      headers: authHeaders
    });
    const pollData = await pollRes.json().catch(() => ({}));
    if (!pollRes.ok) {
      throw new Error(pollData?.error || 'AssemblyAI polling failed');
    }
    if (pollData?.status === 'completed') {
      return { text: String(pollData?.text || '').trim() };
    }
    if (pollData?.status === 'error') {
      throw new Error(pollData?.error || 'AssemblyAI transcription failed');
    }
  }

  throw new Error('AssemblyAI transcription timeout');
}

async function ttsWithElevenLabs(text) {
  const response = await fetch(`${ELEVENLABS_API_URL}/${ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || 'ElevenLabs TTS failed');
  }

  const audioBuffer = await response.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  return URL.createObjectURL(audioBlob);
}

export async function apiFetch(path, options = {}) {
  if (DEMO_MODE) {
    if (path === '/api/auth/me') return { user: DEMO_USER };
    if (path === '/api/auth/login' || path === '/api/auth/signup') return { token: 'demo-token' };
    if (path === '/api/admin/stats') return { users: 1, messages: getDemoMessages().length };
    if (path === '/api/chat/history') return { messages: getDemoMessages() };
    if (path === '/api/voice/transcribe') return { text: 'Hello Maya, this is demo voice input.' };

    if (path === '/api/chat/message') {
      const body = options.body ? JSON.parse(options.body) : { content: '' };
      const messages = getDemoMessages();
      messages.push({ role: 'user', content: body.content || '' });
      const reply = demoReply(body.content || '');
      messages.push({ role: 'assistant', content: reply });
      setDemoMessages(messages);
      return { reply, audioUrl: null };
    }
  }

  if (LLM_PROVIDER === 'openrouter' && path === '/api/chat/message') {
    const body = options.body ? JSON.parse(options.body) : { content: '' };
    return chatWithOpenRouter(body.content || '', body.image || null);
  }

  const urls = resolveApiUrls(path);
  const { res, raw, data } = await fetchWithFallback(urls, {
    ...options,
    credentials: AUTH_BACKEND === 'php' ? 'include' : options.credentials,
    headers: authHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) })
  });
  if (!res.ok) {
    const message = data?.error || raw || 'Request failed';
    throw new Error(message);
  }

  return data;
}

export async function apiUpload(path, formData, options = {}) {
  if (DEMO_MODE && path === '/api/voice/transcribe') {
    return { text: 'Hello Maya, this is demo voice input.' };
  }

  if (STT_PROVIDER === 'assemblyai' && path === '/api/voice/transcribe') {
    return transcribeWithAssemblyAI(formData);
  }

  const urls = resolveApiUrls(path);
  const { res, raw, data } = await fetchWithFallback(urls, {
    method: 'POST',
    ...options,
    credentials: AUTH_BACKEND === 'php' ? 'include' : options.credentials,
    headers: authHeaders(options.headers || {}),
    body: formData
  });
  if (!res.ok) {
    const message = data?.error || raw || 'Upload failed';
    throw new Error(message);
  }
  return data;
}
