const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Ensure data folder & file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(STATS_FILE)) {
  fs.writeFileSync(STATS_FILE, JSON.stringify({ posts: {}, uniqueVisitors: [] }, null, 2));
}

function readStats() {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch {
    return { posts: {}, uniqueVisitors: [] };
  }
}
function saveStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

function getIP(req) {
  let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';
  ip = ip.replace('::ffff:', ''); // Normalize IPv6-mapped IPv4
  return ip.trim();
}

// Middleware to count global unique visitors
app.use((req, res, next) => {
  const stats = readStats();
  const ip = getIP(req);
  if (ip && !stats.uniqueVisitors.includes(ip)) {
    stats.uniqueVisitors.push(ip);
    saveStats(stats);
  }
  next();
});

// Endpoint: increment post view & return updated counts
app.post('/api/view/:slug', (req, res) => {
  const stats = readStats();
  const ip = getIP(req);
  const slug = req.params.slug;

  if (!stats.posts[slug]) {
    stats.posts[slug] = { views: 0, uniqueIPs: [] };
  }

  stats.posts[slug].views++;
  if (ip && !stats.posts[slug].uniqueIPs.includes(ip)) {
    stats.posts[slug].uniqueIPs.push(ip);
  }

  saveStats(stats);

  res.json({
    views: stats.posts[slug].views,
    uniqueViews: stats.posts[slug].uniqueIPs.length,
    totalUniqueVisitors: stats.uniqueVisitors.length
  });
});

// Endpoint: get stats for a specific post
app.get('/api/stats/:slug', (req, res) => {
  const stats = readStats();
  const slug = req.params.slug;
  const postStats = stats.posts[slug] || { views: 0, uniqueIPs: [] };

  res.json({
    views: postStats.views,
    uniqueViews: postStats.uniqueIPs.length,
    totalUniqueVisitors: stats.uniqueVisitors.length
  });
});

// Endpoint: get stats for all posts
app.get('/api/stats', (req, res) => {
  const stats = readStats();
  // Always return consistent keys
  res.json({
    posts: stats.posts || {},
    uniqueVisitors: stats.uniqueVisitors || []
  });
});

// Serve static files
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
