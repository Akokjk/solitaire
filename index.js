const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

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
