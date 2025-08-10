// Simple Klondike Solitaire (Draw 1/3). Pure client-side JS.

(() => {
  const SUITS = ["S","H","D","C"];
  const SUIT_SYMBOL = {S:"♠", H:"♥", D:"♦", C:"♣"};
  const RANKS = [null,"A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  const el = s => document.querySelector(s);
  const els = s => Array.from(document.querySelectorAll(s));

  const stockEl = el("#stock"), wasteEl = el("#waste");
  const foundationEls = [0,1,2,3].map(i => el(`#foundation-${i}`));
  const tableauEls = [0,1,2,3,4,5,6].map(i => el(`#tab-${i}`));

  const timeEl = el("#timeEl"), movesEl = el("#movesEl"), scoreEl = el("#scoreEl");
  const drawThreeToggle = false;
  const undoBtn = el("#undoBtn"), newGameBtn = el("#newGameBtn"), hintBtn = el("#hintBtn");
  const yearEl = el("#yearEl"); if(yearEl) yearEl.textContent = new Date().getFullYear();

  let state = null;
  let timerId = null, seconds = 0, moves = 0, score = 0;
  let history = [];

// ---- Sprite sheet config ----
const CARD_W = 88, CARD_H = 124, COLS = 5; // 5 columns x 3 rows
const SHEETS = {
  S: "/graphics/Top-Down/Spades-88x124.png",
  H: "/graphics/Top-Down/Hearts-88x124.png",
  D: "/graphics/Top-Down/Diamonds-88x124.png",
  C: "/graphics/Top-Down/Clubs-88x124.png"
};
(function preload(){
  const urls = Object.values(SHEETS).concat("/graphics/Top-Down/Card_Back-88x124.png");
  urls.forEach(u => { const i = new Image(); i.src = u; });
})();

// 1..13 -> background-position within a 5x3 grid
function spritePosForRank(rank){
  const index = rank - 1;            // 0..12
  const col = index % COLS;          // 0..4
  const row = Math.floor(index / COLS); // 0..2
  return `-${col * CARD_W}px -${row * CARD_H}px`;
}



  function newDeck(){
    const deck = [];
    for(const s of SUITS) for(let r=1;r<=13;r++){
      const color = (s==="H"||s==="D") ? "red" : "black";
      deck.push({id:`${s}${r}`, suit:s, rank:r, color, faceUp:false});
    }
    for(let i=deck.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
    return deck;
  }

  function deal(drawThree=false){
    const deck = newDeck();
    const tableau = Array.from({length:7}, ()=>[]);
    for(let i=0;i<7;i++){
      for(let j=0;j<=i;j++){
        const card = deck.pop();
        card.faceUp = (j===i);
        tableau[i].push(card);
      }
    }
    state = {stock:deck, waste:[], tableau, foundations:[[],[],[],[]], drawThree};
    seconds=0; moves=0; score=0; history=[];
    renderAll(); startTimer();
  }

  function startTimer(){
    if(timerId) clearInterval(timerId);
    timerId = setInterval(()=>{
      seconds++;
      timeEl.textContent = formatTime(seconds);
    }, 1000);
  }
  const formatTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  function pushHistory(){ history.push(JSON.stringify(state)); if(history.length>200) history.shift(); }
  function undo(){ if(!history.length) return; state=JSON.parse(history.pop()); moves=Math.max(0,moves-1); renderAll(); }

 function cardEl(card){
  const div = document.createElement("div");
  div.className = `card ${card.faceUp ? "faceup" : "facedown"} ${card.color}`;

  // Size safety (if CSS variables ever change)
  div.style.width = CARD_W + "px";
  div.style.height = CARD_H + "px";

  // Data for interactions
  div.dataset.id = card.id;
  div.dataset.suit = card.suit;
  div.dataset.rank = card.rank;
  div.dataset.color = card.color;

  if(card.faceUp){
    // Use suit sprite sheet and position to show the correct rank
    div.style.backgroundImage = `url("${SHEETS[card.suit]}")`;
    div.style.backgroundPosition = spritePosForRank(card.rank);

    // (We can skip inner text entirely; keep content node only if you want a11y text)
    // const c = document.createElement("div");
    // c.className = "content";
    // c.setAttribute("aria-label", `${RANKS[card.rank]} of ${card.suit}`);
    // div.appendChild(c);
  }else{
    // Choose which back to show (blue or red). Default red:
    div.classList.add("back-red");
    // To switch globally to blue backs, use: div.classList.add("back-blue");
  }

  return div;
}

  // replace your current renderPile with this version
function renderPile(pileEl, cards, stacked = false){
  pileEl.innerHTML = "";

  const isStock = pileEl.id === "stock";
  const yStepOpen = stacked ? 28 : 0;

  // tiny fan for facedown cards in the stock pile; larger default elsewhere
  const yStepFaceDown = isStock ? 0 : Math.max(10, yStepOpen * 0.6);

  cards.forEach((card, idx) => {
    const c = cardEl(card);

    const top =
      card.faceUp
        ? idx * yStepFaceDown   // face-up piles (waste/tableau/foundation)
        : idx * yStepFaceDown;              // face-down piles (stock)

    
	 // Waste pile should not offset cards vertically
    if (pileEl.id === "waste") {
      c.style.top = "0px";
    } else {
      c.style.top = `${top}px`;
    }
	
	if (pileEl.id === "foundation-0" || pileEl.id === "foundation-1" || pileEl.id === "foundation-2" || pileEl.id === "foundation-3" ) {
		c.style.top = "0px";
    }
    c.style.left = "0px";
    c.style.zIndex = String(10 + idx);
    pileEl.appendChild(c);
  });

  if (!cards.length) {
    const ph = document.createElement("div");
    ph.className = "placeholder";
    pileEl.appendChild(ph);
  }
}

  function renderAll(){
    renderPile(stockEl, state.stock);
    renderPile(wasteEl, state.waste);
    state.foundations.forEach((f,i)=>renderPile(foundationEls[i], f));
    tableauEls.forEach((el,i)=>renderPile(el, state.tableau[i], true));
    movesEl.textContent=String(moves); scoreEl.textContent=String(score);
    //drawThreeToggle.checked= false;
    attachInteractions();
    checkWin();
  }

  function pileOf(card){
    if(state.stock.includes(card)) return {type:"stock", pile:state.stock};
    if(state.waste.includes(card)) return {type:"waste", pile:state.waste};
    for(let i=0;i<4;i++) if(state.foundations[i].includes(card)) return {type:"foundation", index:i, pile:state.foundations[i]};
    for(let i=0;i<7;i++) if(state.tableau[i].includes(card)) return {type:"tableau", index:i, pile:state.tableau[i]};
    return null;
  }
  const canPlaceOnFoundation=(card,i)=>{
    const pile=state.foundations[i]; if(!pile.length) return card.rank===1;
    const top=pile[pile.length-1]; return top.suit===card.suit && card.rank===top.rank+1;
  };
  const topFaceUp=pile=>{ for(let i=pile.length-1;i>=0;i--) if(pile[i].faceUp) return pile[i]; return null; };
  const canPlaceOnTableau=(card,i)=>{
    const pile=state.tableau[i]; if(!pile.length) return card.rank===13;
    const top=topFaceUp(pile); if(!top) return false; return top.color!==card.color && card.rank===top.rank-1;
  };

  function tryAutoToFoundation(card){
    if(!card.faceUp) return false; let moved=false; const src=pileOf(card);
    for(let i=0;i<4;i++) if(canPlaceOnFoundation(card,i)){
      pushHistory(); const idx=src.pile.indexOf(card); src.pile.splice(idx,1); state.foundations[i].push(card);
      if(src.type==="tableau" && src.pile.length && !src.pile.some(c=>c.faceUp)){ src.pile[src.pile.length-1].faceUp=true; score+=5; }
      moves++; score+=10; moved=true; break;
    }
    return moved;
  }
  function tryAutoToTableau(card){
    if(!card.faceUp) return false; const src=pileOf(card); const idx=src.pile.indexOf(card); const seq=src.pile.slice(idx);
    for(let i=0;i<seq.length-1;i++){ const a=seq[i], b=seq[i+1]; if(!(a.faceUp&&b.faceUp&&a.color!==b.color&&a.rank===b.rank+1)) return false; }
    for(let i=0;i<7;i++) if(canPlaceOnTableau(card,i)){
      pushHistory(); const chunk=src.pile.splice(idx, seq.length); state.tableau[i].push(...chunk);
      if(src.type==="tableau" && src.pile.length && !src.pile.some(c=>c.faceUp)){ src.pile[src.pile.length-1].faceUp=true; score+=5; }
      moves++; score+=5; return true;
    }
    return false;
  }

  function enableDrag(){
    let dragging=null, dragOrigin=null, offsetX=0, offsetY=0;

    function pickSequence(node){
	  const id = node.dataset.id;
	  const card = getCardById(id);
	  if (!card || !card.faceUp) return null;

	  const src = pileOf(card);
	  if (src.type === "foundation") return [card];

	  const pile = src.pile;
	  const start = pile.indexOf(card);

	  // grow the sequence only while it remains a valid alternating run
	  const seq = [pile[start]];
	  for (let i = start; i < pile.length - 1; i++) {
		const a = pile[i], b = pile[i+1];
		if (!(a.faceUp && b.faceUp && a.color !== b.color && a.rank === b.rank + 1)) break;
		seq.push(b);
	  }
	  return seq;
	}

    function onPointerDown(e){
      const node=e.target.closest(".card"); if(!node) return;
      const seq=pickSequence(node); if(!seq) return;
      dragging=seq; dragOrigin=pileOf(seq[0]);
      const rect=node.getBoundingClientRect(); offsetX=e.clientX-rect.left; offsetY=e.clientY-rect.top;
      seq.forEach((c,i)=>{ const n=document.querySelector(`.card[data-id="${c.id}"]`); n.style.pointerEvents="none"; n.style.zIndex=1000+i; n.style.transform="rotate(.5deg)"; });
      document.addEventListener("pointermove", onPointerMove); document.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(e){
      if(!dragging) return;
      dragging.forEach((c,i)=>{ const n=document.querySelector(`.card[data-id="${c.id}"]`); const x=e.clientX-offsetX; const y=e.clientY-offsetY+i*28; n.style.position="fixed"; n.style.left=x+"px"; n.style.top=y+"px"; });
    }

    function dropTarget(e){
      const elements=document.elementsFromPoint(e.clientX, e.clientY);
      return elements.find(el => el.classList && el.classList.contains("pile")) || null;
    }

    function onPointerUp(e){
      if(!dragging) return;
      const seq=dragging; dragging=null;
      seq.forEach((c,i)=>{ const n=document.querySelector(`.card[data-id="${c.id}"]`); n.style.pointerEvents=""; n.style.zIndex=""; n.style.transform=""; n.style.position=""; n.style.left=""; n.style.top=""; });
      const destEl=dropTarget(e); if(!destEl){ renderAll(); cleanup(); return; }
      const first=seq[0]; const src=dragOrigin;
      let moved=false;

      if(destEl.classList.contains("foundation") && seq.length===1){
        const idx=Number(destEl.id.split("-")[1]);
        if(canPlaceOnFoundation(first, idx)){
          pushHistory(); const i=src.pile.indexOf(first); src.pile.splice(i,1); state.foundations[idx].push(first);
          if(src.type==="tableau" && src.pile.length && !src.pile.some(c=>c.faceUp)){ src.pile[src.pile.length-1].faceUp=true; score+=5; }
          moved=true; score+=10; moves++;
        }
      }else if(destEl.classList.contains("tableau")){
        const idx=Number(destEl.id.split("-")[1]);
        if(canPlaceOnTableau(first, idx) || (state.tableau[idx].length===0 && first.rank===13)){
          pushHistory(); const i=src.pile.indexOf(first); const chunk=src.pile.splice(i, seq.length); state.tableau[idx].push(...chunk);
          if(src.type==="tableau" && src.pile.length && !src.pile.some(c=>c.faceUp)){ src.pile[src.pile.length-1].faceUp=true; score+=5; }
          moved=true; score+=5; moves++;
        }
      }

      renderAll(); cleanup();
    }

    function cleanup(){ document.removeEventListener("pointermove", onPointerMove); document.removeEventListener("pointerup", onPointerUp); dragOrigin=null; }
    document.querySelectorAll(".pile, .card").forEach(n=>{ n.onpointerdown=onPointerDown; });
  }

  function getCardById(id){
    for(const c of state.stock) if(c.id===id) return c;
    for(const c of state.waste) if(c.id===id) return c;
    for(const pile of state.foundations) for(const c of pile) if(c.id===id) return c;
    for(const pile of state.tableau) for(const c of pile) if(c.id===id) return c;
    return null;
  }

  function attachInteractions(){
    // stock click
    el("#stock").onclick = () => {
      if(!state.stock.length){
        if(!state.waste.length) return;
        pushHistory();
        while(state.waste.length){ const c=state.waste.pop(); c.faceUp=false; state.stock.push(c); }
        moves++; score=Math.max(0, score-20); renderAll(); return;
      }
      pushHistory();
      const n = state.drawThree ? Math.min(3, state.stock.length) : 1;
      for(let i=0;i<n;i++){ const c=state.stock.pop(); c.faceUp=true; state.waste.push(c); }
      moves++; score+=5; renderAll();
    };

    // dblclick auto-move
    els(".card.faceup").forEach(n => n.ondblclick = () => {
      const card=getCardById(n.dataset.id); if(!card) return;
      if(tryAutoToFoundation(card) || tryAutoToTableau(card)) renderAll();
    });

    enableDrag();
  }
// --- Fireworks overlay ---
let __fxRunning = false;
// --- Fireworks (runs until stopFireworks) ---
let __fx = {
  running: false, canvas: null, ctx: null,
  particles: [], raf: 0, interval: 0, onResize: null
};

function showFireworks(){
  if (__fx.running) return;
  __fx.running = true;

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '9998',        // under the win overlay
    pointerEvents: 'none'  // let overlay buttons click
  });
  document.body.appendChild(canvas);
  __fx.canvas = canvas;
  __fx.ctx = canvas.getContext('2d');

  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    __fx.ctx.setTransform(1,0,0,1,0,0);
    __fx.ctx.scale(dpr, dpr);
  }
  __fx.onResize = resize;
  resize();
  window.addEventListener('resize', resize);

  function burst(x, y){
    const colors = ['#ffd166','#ef476f','#06d6a0','#118ab2','#c77dff'];
    const color = colors[(Math.random()*colors.length)|0];
    const count = 90 + (Math.random()*40)|0;
    for (let i=0;i<count;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = 250 + Math.random()*650;
      __fx.particles.push({
        x, y,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd,
        life: 1,
        size: 2 + Math.random()*2,
        color
      });
    }
  }

  const gravity = 1200, drag = 0.985;
  let last = performance.now();

  function frame(now){
    if (!__fx.running) return;
    const dt = Math.min(0.033, (now - last)/1000); last = now;
    const ctx = __fx.ctx;
    ctx.clearRect(0,0, __fx.canvas.width, __fx.canvas.height);

    for (let i=__fx.particles.length-1;i>=0;i--){
      const p = __fx.particles[i];
      p.vy += gravity*dt;
      p.vx *= drag; p.vy *= drag;
      p.x  += p.vx*dt; p.y += p.vy*dt;
      p.life -= dt*0.5;
      if (p.life <= 0) __fx.particles.splice(i,1);
    }

    for (const p of __fx.particles){
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fillStyle = p.color; ctx.fill();
    }
    ctx.globalAlpha = 1;

    __fx.raf = requestAnimationFrame(frame);
  }

  // keep launching until stopped
  function launch(){
    burst(
      Math.random()*window.innerWidth,
      window.innerHeight*0.25 + Math.random()*window.innerHeight*0.5
    );
  }
  __fx.interval = setInterval(launch, 450);
  // kickstart a couple bursts immediately
  for (let i=0;i<3;i++) setTimeout(launch, i*150);

  __fx.raf = requestAnimationFrame(frame);
}

function stopFireworks(){
  if (!__fx.running) return;
  __fx.running = false;
  clearInterval(__fx.interval);
  cancelAnimationFrame(__fx.raf);
  window.removeEventListener('resize', __fx.onResize);
  __fx.canvas.remove();
  __fx = { running:false, canvas:null, ctx:null, particles:[], raf:0, interval:0, onResize:null };
}

function showWinOverlay(){
  if (document.getElementById('winOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'winOverlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '10000',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(0,0,0,0.6)'
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    textAlign: 'center',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial',
    padding: '28px 32px',
    borderRadius: '16px',
    background: 'linear-gradient(180deg, rgba(20,28,40,.85), rgba(12,18,30,.85))',
    border: '1px solid rgba(255,255,255,.15)',
    boxShadow: '0 20px 60px rgba(0,0,0,.45)',
    minWidth: 'min(92vw, 520px)'
  });

  const h1 = document.createElement('div');
  h1.textContent = 'You win!';
  Object.assign(h1.style, { fontSize: '44px', fontWeight: '800', marginBottom: '8px', letterSpacing: '.5px' });

  const sub = document.createElement('div');
  sub.textContent = `Time ${formatTime(seconds)} · Moves ${moves} · Score ${score}`;
  Object.assign(sub.style, { opacity: .9, marginBottom: '18px', fontSize: '16px' });

  const btn = document.createElement('button');
  btn.textContent = 'New Game';
  Object.assign(btn.style, {
    fontSize: '16px',
    padding: '10px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,.25)',
    background: '#1b283a',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(0,0,0,.35)'
  });

  btn.onclick = () => {
    removeWinOverlay();
    stopFireworks();
    deal(drawThreeToggle.checked); // same new game flow as the top button
  };

  panel.append(h1, sub, btn);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function removeWinOverlay(){
  const o = document.getElementById('winOverlay');
  if (o) o.remove();
}

 

	function checkWin(){
	  const complete = state.foundations.every(p => p.length===13);
	  if(!complete) return;
	  clearInterval(timerId);
	  showFireworks(); // 🎆 instead of alert
	  showWinOverlay();
	}


  // Buttons/keys

  undoBtn.onclick = () => undo();
  newGameBtn.onclick = () => {
  removeWinOverlay();
  stopFireworks();
  deal(false);
};
  hintBtn.onclick = () => {
    const topWaste=state.waste[state.waste.length-1];
    if(topWaste && (tryAutoToFoundation(topWaste) || tryAutoToTableau(topWaste))){ renderAll(); return; }
    for(const pile of state.tableau){
      for(let i=pile.length-1;i>=0;i--){
        if(pile[i].faceUp && (tryAutoToFoundation(pile[i]) || tryAutoToTableau(pile[i]))){ renderAll(); return; }
      }
    }
    el("#stock").click();
  };
  window.addEventListener("keydown", e=>{
    if(e.key==="n"||e.key==="N") newGameBtn.click();
    if(e.key==="u"||e.key==="U") undoBtn.click();
    if(e.key==="h"||e.key==="H") hintBtn.click();
    if(e.key===" ") el("#stock").click();
	 if(e.key==="f"||e.key==="F") {
		 showWinOverlay();
		 showFireworks();
	 } 
  });

  // boot
  deal(false);
})();
