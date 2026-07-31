const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const scoreEl = document.getElementById('score'), livesEl = document.getElementById('lives'), roundEl = document.getElementById('round'), msgEl = document.getElementById('msg');

// ---------- difficulty ----------
const DIFF = {
  easy:   { speed: 0.65, shoot: 0.55, dive: 0.5, stray: 0.5 },
  normal: { speed: 1,    shoot: 1,    dive: 1,   stray: 1 },
  hard:   { speed: 1.5,  shoot: 1.8,  dive: 1.8, stray: 1.8 },
};
let difficulty = 'normal';
document.querySelectorAll('#diff button').forEach(btn => {
  btn.addEventListener('click', () => {
    difficulty = btn.dataset.d;
    document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('active', b === btn));
    ensureAudio();
  });
});

let keys = {};
addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if (e.key === 'r' || e.key === 'R') if (state.over) init();
  ensureAudio();
});
addEventListener('keyup', e => keys[e.key] = false);

const COLS = 11, ROWS = 5, A_W = 34, A_H = 24, A_GAP = 14;
const gridW = COLS * (A_W + A_GAP) - A_GAP;
const ROW_COLORS = ['#ff4fd0','#ff8a4f','#ffe14f','#4fff8a','#4ff3ff'];
const ROUND_THRESHOLDS = [200, 400];
const DIVE_DEPTH = H - 160;
const COUNTDOWN_FRAMES = 240;
const COUNTDOWN_LABELS = ['3', '2', '1', 'GO!'];

// each entry maps a (row, col) grid cell to a shape offset / skip flag, cycled per wave for variety
const PATTERNS = [
  (r, c) => ({ dx: 0, dy: 0, skip: false }),                                   // standard grid
  (r, c) => ({ dx: 0, dy: Math.abs(c-5)*7, skip: false }),                     // arch / chevron
  (r, c) => ({ dx: 0, dy: 0, skip: Math.abs(c-5)+Math.abs(r-2) > 6 }),         // diamond
  (r, c) => ({ dx: (r%2)*16 - 8, dy: 0, skip: false }),                        // staggered zigzag
];

let state, player, aliens, bullets, aBullets, particles;

// row 0 = circler (orbits in place), row 1 = diver (swoops down & back), rest = standard grid
function typeForRow(r) { return r === 0 ? 'circler' : r === 1 ? 'diver' : 'grid'; }

function spawnAliens() {
  aliens = [];
  const offX = (W - gridW) / 2;
  const pattern = PATTERNS[state.wave % PATTERNS.length];
  state.wave++;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const { dx, dy, skip } = pattern(r, c);
      if (skip) continue;
      const type = typeForRow(r);
      const baseX = offX + c*(A_W+A_GAP) + dx, baseY = 70 + r*(A_H+A_GAP) + dy;
      aliens.push({
        baseX, baseY, x: baseX, y: baseY - 220,
        w: A_W, h: A_H, alive: true, row: r, type,
        angle: Math.random()*Math.PI*2,
        diveState: 'idle', diveTimer: 120 + Math.random()*300, diveProgress: 0,
      });
    }
  state.dir = 1;
  state.formX = 0; state.formY = 0;
  state.speed = (1 + (state.round - 1) * 0.5) * DIFF[difficulty].speed;
  bullets = []; aBullets = [];
  state.phase = 'countdown';
  state.countdownTimer = COUNTDOWN_FRAMES;
}

function init() {
  state = { score: 0, lives: 3, over: false, round: 1, wave: 0, shootTimer: 0 };
  player = { x: W/2 - 20, y: H - 50, w: 40, h: 20, speed: 6, missing: new Set() };
  particles = [];
  spawnAliens();
  msgEl.style.display = 'none';
}

function spawnParticles(x, y, color, { count = 12, grav = 0, blood = false } = {}) {
  for (let i = 0; i < count; i++) {
    const a = Math.random()*Math.PI*2, sp = 1 + Math.random()*(blood ? 4 : 3);
    particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - (blood ? 1 : 0), life: 25 + Math.random()*20, color, size: blood ? 2 + Math.random()*3 : 3, grav });
  }
}

// chip pixels off the ship on each hit; on the killing hit, strip it bare for a full "explosion" look
function damageShip(lethal) {
  if (lethal) { SHIP_PIXELS.forEach(p => player.missing.add(p)); }
  else {
    const remaining = SHIP_PIXELS.filter(p => !player.missing.has(p));
    for (let i = 0; i < 6 && remaining.length; i++) {
      const idx = Math.floor(Math.random()*remaining.length);
      player.missing.add(remaining.splice(idx, 1)[0]);
    }
  }
  spawnParticles(player.x+player.w/2, player.y+player.h/2, lethal ? '#ff8a4f' : '#4ff3ff', { count: lethal ? 26 : 10, grav: 0.1 });
}

function hitPlayer() {
  state.lives--;
  const lethal = state.lives <= 0;
  damageShip(lethal);
  sfx.hit();
  if (lethal) endGame();
}

function update() {
  if (state.over) return;

  if (state.phase === 'countdown') {
    state.countdownTimer--;
    const introT = Math.min(1, (COUNTDOWN_FRAMES - state.countdownTimer) / 40);
    const eased = 1 - Math.pow(1-introT, 3); // ease-out cubic slide-in
    for (const a of aliens) a.y = a.baseY - (1-eased) * 220;
    if (state.countdownTimer <= 0) state.phase = 'playing';
    return;
  }

  const d = DIFF[difficulty];

  if (keys['ArrowLeft']) player.x -= player.speed;
  if (keys['ArrowRight']) player.x += player.speed;
  player.x = Math.max(0, Math.min(W - player.w, player.x));

  state.shootTimer--;
  if (keys[' '] && state.shootTimer <= 0) {
    bullets.push({ x: player.x + player.w/2 - 2, y: player.y, w: 4, h: 12 });
    state.shootTimer = 18;
    sfx.shoot();
  }

  bullets.forEach(b => b.y -= 9);
  bullets = bullets.filter(b => b.y > -20);
  aBullets.forEach(b => b.y += b.vy || 5);
  aBullets = aBullets.filter(b => b.y < H + 20);

  // occasional stray bullet from nowhere, independent of any alien
  if (Math.random() < 0.006 * d.stray) {
    aBullets.push({ x: Math.random()*(W-4), y: -10, w: 4, h: 12, vy: 6, color: '#b34fff' });
  }

  const alive = aliens.filter(a => a.alive);

  // formation bounds use each alien's base grid position (orbit/dive offsets excluded)
  let minX = Infinity, maxX = -Infinity;
  for (const a of alive) { minX = Math.min(minX, a.baseX+state.formX); maxX = Math.max(maxX, a.baseX+state.formX+a.w); }
  let hitEdge = false;
  if (maxX >= W && state.dir === 1) hitEdge = true;
  if (minX <= 0 && state.dir === -1) hitEdge = true;
  if (hitEdge) {
    state.dir *= -1;
    state.speed += 0.18 * d.speed;
    state.formY += 16;
  }
  state.formX += state.dir * state.speed;

  for (const a of alive) {
    const bx = a.baseX + state.formX, by = a.baseY + state.formY;
    if (a.type === 'circler') {
      a.angle += 0.05;
      a.x = bx + Math.cos(a.angle) * 18;
      a.y = by + Math.sin(a.angle) * 10;
    } else if (a.type === 'diver') {
      if (a.diveState === 'idle') {
        a.diveTimer--;
        a.x = bx; a.y = by;
        if (a.diveTimer <= 0 && Math.random() < 0.004 * d.dive) a.diveState = 'diving';
      } else if (a.diveState === 'diving') {
        a.diveProgress = Math.min(1, a.diveProgress + 0.016 * d.dive);
        a.x = bx + Math.sin(a.diveProgress*6) * 40;
        a.y = by + a.diveProgress * (DIVE_DEPTH - by);
        if (a.diveProgress >= 1) a.diveState = 'returning';
      } else {
        a.diveProgress = Math.max(0, a.diveProgress - 0.025 * d.dive);
        a.x = bx + Math.sin(a.diveProgress*6) * 40;
        a.y = by + a.diveProgress * (DIVE_DEPTH - by);
        if (a.diveProgress <= 0) { a.diveState = 'idle'; a.diveTimer = 150 + Math.random()*300; }
      }
    } else {
      a.x = bx; a.y = by;
    }
  }

  if (Math.random() < (0.015 + alive.length * 0.0003) * d.shoot && alive.length) {
    const shooter = alive[Math.floor(Math.random()*alive.length)];
    aBullets.push({ x: shooter.x + shooter.w/2 - 2, y: shooter.y + shooter.h, w: 4, h: 12, vy: 5 });
    sfx.alienShoot();
  }

  for (const b of bullets) {
    for (const a of alive) {
      if (!a.alive) continue;
      if (b.x < a.x+a.w && b.x+b.w > a.x && b.y < a.y+a.h && b.y+b.h > a.y) {
        a.alive = false; b.y = -999;
        state.score += (ROWS - a.row) * 10;
        spawnParticles(a.x+a.w/2, a.y+a.h/2, ROW_COLORS[a.row], { count: 16, grav: 0.15, blood: true });
        sfx.explosion();
      }
    }
  }
  bullets = bullets.filter(b => b.y > -20);

  const nextRound = ROUND_THRESHOLDS.filter(t => state.score >= t).length + 1;
  if (nextRound > state.round) {
    state.round = nextRound;
    spawnAliens();
    sfx.round();
  }

  for (const b of aBullets) {
    if (b.x < player.x+player.w && b.x+b.w > player.x && b.y < player.y+player.h && b.y+b.h > player.y) {
      b.y = H + 999;
      hitPlayer();
    }
  }
  aBullets = aBullets.filter(b => b.y < H + 20);

  // direct contact with an attacker costs a life instead of ending the game outright
  for (const a of alive) {
    if (!a.alive) continue;
    if (a.x < player.x+player.w && a.x+a.w > player.x && a.y < player.y+player.h && a.y+a.h > player.y) {
      a.alive = false;
      hitPlayer();
    }
  }

  particles.forEach(p => { p.vy += p.grav || 0; p.x += p.vx; p.y += p.vy; p.life--; });
  particles = particles.filter(p => p.life > 0);

  if (alive.every(a => !a.alive)) spawnAliens();

  scoreEl.textContent = 'SCORE: ' + state.score;
  roundEl.textContent = 'ROUND: ' + state.round;
  livesEl.textContent = 'LIVES: ' + '♥'.repeat(Math.max(state.lives,0));
}

function endGame() {
  state.over = true;
  msgEl.style.display = 'block';
  sfx.gameOver();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  aliens.forEach(a => a.alive && drawAlien(a));
  bullets.forEach(b => drawBolt(b.x, b.y, b.w, b.h, '#4fff8a'));
  aBullets.forEach(b => drawBolt(b.x, b.y, b.w, b.h, b.color || '#ff4f4f'));

  const shipColor = player.missing.size > 12 ? '#ff8a4f' : '#4ff3ff';
  drawSprite(SHIP_SPRITE, player.x, player.y - 8, player.w, player.h + 8, shipColor, player.missing);

  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / 35);
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3);
    ctx.restore();
  });

  if (state.phase === 'countdown') {
    const elapsed = COUNTDOWN_FRAMES - state.countdownTimer;
    const label = COUNTDOWN_LABELS[Math.min(3, Math.floor(elapsed / 60))];
    const bannerT = Math.min(1, elapsed / 20);
    const bannerX = W/2 - Math.pow(1-bannerT, 3) * 200; // slides in from the left, ease-out
    ctx.save();
    ctx.fillStyle = '#04050f99';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4fd0';
    ctx.shadowColor = '#ff4fd0'; ctx.shadowBlur = 24;
    ctx.font = 'bold 64px monospace';
    ctx.fillText(label, W/2, H/2);
    ctx.fillStyle = '#4ff3ff';
    ctx.shadowColor = '#4ff3ff'; ctx.shadowBlur = 12;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('ROUND ' + state.round, bannerX, H/2 - 70);
    ctx.restore();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

init();
loop();
