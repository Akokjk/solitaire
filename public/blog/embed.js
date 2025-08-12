(() => {
  const slugFromPath = () => {
    // e.g. /blogs/welcome.html -> "welcome"
    const parts = location.pathname.split('/').filter(Boolean);
    const leaf = parts[parts.length - 1] || '';
    return (leaf.replace(/\.html$/, '') || 'post');
  };

  const slugAttr = document.currentScript?.dataset?.slug;
  const slug = (slugAttr || slugFromPath());

  const root = document.getElementById('comments-root') || (() => {
    const d = document.createElement('div');
    d.id = 'comments-root';
    document.body.appendChild(d);
    return d;
  })();

  const css = document.createElement('style');
  css.textContent = `
  .cm-wrap{max-width:900px;margin:24px auto;padding:16px;background:linear-gradient(180deg,#111a2a,#0e1624);border:1px solid rgba(255,255,255,.06);border-radius:14px;box-shadow:var(--shadow)}
  .cm-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .cm-reactions{display:flex;gap:8px;margin:8px 0 16px}
  .cm-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:6px 10px;background:#0d1727;cursor:pointer}
  .cm-chip[disabled]{opacity:.6;cursor:default}
  .cm-list{display:flex;flex-direction:column;gap:12px;margin-top:12px}
  .cm-item{background:#0d1727;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px}
  .cm-meta{font-size:12px;color:var(--muted);margin-bottom:6px}
  .cm-form{display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px}
  .cm-row{display:flex;gap:8px}
  .cm-input, .cm-text{flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#0b1526;color:var(--ink)}
  .cm-btn{background:var(--panel);color:var(--ink);border:1px solid rgba(255,255,255,.1);padding:10px 14px;border-radius:10px;cursor:pointer}
  .cm-hp{position:absolute;left:-9999px;top:-9999px} /* honeypot */
  `;
  document.head.appendChild(css);

  root.innerHTML = `
    <section class="cm-wrap">
      <div class="cm-head"><h2 style="margin:0">Comments</h2></div>
      <div class="cm-reactions">
        <button class="cm-chip" data-type="like">👍 <span class="cnt" data-type="like">0</span></button>
        <button class="cm-chip" data-type="love">❤️ <span class="cnt" data-type="love">0</span></button>
        <button class="cm-chip" data-type="wow">🎉 <span class="cnt" data-type="wow">0</span></button>
      </div>
      <div class="cm-list" id="cmList"></div>
      <form class="cm-form" id="cmForm" autocomplete="off" novalidate>
        <div class="cm-row">
          <input class="cm-input" id="cmName" maxlength="40" placeholder="Your name" required />
        </div>
        <textarea class="cm-text" id="cmMsg" rows="4" maxlength="1000" placeholder="Say something nice…" required></textarea>
        <input class="cm-hp" id="cmHp" name="company" tabindex="-1" autocomplete="nope" /> 
        <div class="cm-row" style="justify-content:flex-end">
          <button class="cm-btn" type="submit">Post comment</button>
        </div>
      </form>
    </section>
  `;

  const listEl = root.querySelector('#cmList');
  const formEl = root.querySelector('#cmForm');
  const nameEl = root.querySelector('#cmName');
  const msgEl = root.querySelector('#cmMsg');
  const hpEl = root.querySelector('#cmHp');

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }
  function renderComments(items=[]) {
    listEl.innerHTML = items.map(c => `
      <div class="cm-item">
        <div class="cm-meta">${c.name} • ${fmtDate(c.createdAt)}</div>
        <div>${c.message}</div>
      </div>
    `).join('') || `<div class="cm-item"><div class="cm-meta">Be first!</div><div>No comments yet.</div></div>`;
  }
  async function load() {
    const [cR, rR] = await Promise.all([
      fetch('/api/comments/'+slug).then(r=>r.json()).catch(()=>({comments:[]})),
      fetch('/api/reactions/'+slug).then(r=>r.json()).catch(()=>({counts:{}}))
    ]);
    renderComments(cR.comments || []);
    const counts = rR.counts || {};
    root.querySelectorAll('.cnt').forEach(span => {
      const t = span.dataset.type;
      span.textContent = counts[t] || 0;
    });
  }
  load();

  // Reactions
  root.querySelectorAll('.cm-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      btn.disabled = true;
      try {
        const res = await fetch('/api/reactions/'+slug, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ type })
        }).then(r=>r.json());
        const counts = res.counts || {};
        root.querySelectorAll('.cnt').forEach(span => {
          const t = span.dataset.type;
          span.textContent = counts[t] || 0;
        });
      } finally {
        setTimeout(()=>{ btn.disabled = false; }, 600);
      }
    });
  });

  // Comments
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim();
    const message = msgEl.value.trim();
    if (!name || !message) return;
    const honeypot = hpEl.value || '';
    const btn = formEl.querySelector('.cm-btn');
    btn.disabled = true;
    try {
      const res = await fetch('/api/comments/'+slug, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, message, honeypot })
      }).then(r=>r.json());
      if (res.ok) {
        nameEl.value = '';
        msgEl.value = '';
        await load();
      } else {
        alert(res.error || 'Failed to post comment.');
      }
    } finally {
      btn.disabled = false;
    }
  });
})();
