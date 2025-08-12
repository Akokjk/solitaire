const express = require('express');
const path = require('path');
const fs = require('fs');               // 🔸
const crypto = require('crypto');       // 🔸
const app = express();
const PORT = process.env.PORT || 3000;

// 🔸 Parse JSON bodies
app.use(express.json({ limit: '100kb' }));
app.set('trust proxy', 1);

// 🔸 Simple in-memory rate limit (per IP)
const ipHits = new Map();
function rateLimit(windowMs = 10_000, max = 6) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const list = (ipHits.get(ip) || []).filter(t => now - t < windowMs);
    list.push(now);
    ipHits.set(ip, list);
    if (list.length > max) return res.status(429).json({ ok:false, error: 'Too many requests. Please slow down.' });
    next();
  };
}

// 🔸 Load/save helpers
const DATA_PATH = path.join(__dirname, 'data', 'comments.json');
function readStore() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { comments:{}, reactions:{} };
  }
}
function writeStore(store) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}
function escapeText(s = '') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function normalizeSlug(slug='') {
  // Accept either "welcome" or "/blogs/welcome.html"
  if (slug.endsWith('.html')) slug = slug.replace(/\.html$/, '');
  slug = slug.replace(/^\/+/, '').replace(/^blogs\//,'');
  return slug || 'post';
}

// 🔸 Comments API
app.get('/api/comments/:slug', (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  const store = readStore();
  res.json({ ok:true, comments: store.comments[slug] || [] });
});

app.post('/api/comments/:slug', rateLimit(), (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  let { name, message, honeypot } = req.body || {};
  // Basic validation + spam guard (honeypot field must be empty)
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return res.status(200).json({ ok:true, comments: [] }); // silently ignore
  }
  name = (name || '').trim().slice(0, 40);
  message = (message || '').trim().slice(0, 1000);
  if (!name || !message) return res.status(400).json({ ok:false, error: 'Name and message are required.' });

  const store = readStore();
  const list = store.comments[slug] || [];
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Store escaped text to be safe
  list.push({ id, name: escapeText(name), message: escapeText(message), createdAt });
  store.comments[slug] = list;
  writeStore(store);
  res.json({ ok:true, comment: { id, name, message, createdAt } });
});

// 🔸 Reactions API (👍 ❤️ 🎉, etc.)
const ALLOWED_REACTIONS = ['like', 'love', 'wow'];
app.get('/api/reactions/:slug', (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  const store = readStore();
  const counts = store.reactions[slug] || {};
  res.json({ ok:true, counts });
});
app.post('/api/reactions/:slug', rateLimit(), (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  const { type } = req.body || {};
  if (!ALLOWED_REACTIONS.includes(type)) {
    return res.status(400).json({ ok:false, error: 'Invalid reaction type.' });
  }
  const store = readStore();
  const entry = store.reactions[slug] || {};
  entry[type] = (entry[type] || 0) + 1;
  store.reactions[slug] = entry;
  writeStore(store);
  res.json({ ok:true, counts: entry });
});

// Static assets
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
  })
);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Solitaire running at http://localhost:${PORT}`);
});
