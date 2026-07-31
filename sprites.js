// ---------- pixel-art sprites (8x6 for aliens, 9x7 for the ship) ----------
const SPRITES = {
  grid:    ['00100100','00111100','01111110','11011011','11111111','10100101'],
  circler: ['00111100','01111110','11111111','11011011','01111110','00100100'],
  diver:   ['00011000','00111100','01111110','11100111','11111111','01001010'],
};
const SHIP_SPRITE = ['000010000','000111000','000111000','001111100','011111110','111111111','101000101'];
const SHIP_PIXELS = [];
SHIP_SPRITE.forEach((row, r) => [...row].forEach((v, c) => v === '1' && SHIP_PIXELS.push(r*9+c)));

function drawSprite(pattern, x, y, w, h, color, skip, glow = 8) {
  const cols = pattern[0].length, rows = pattern.length, cw = w/cols, ch = h/rows;
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  pattern.forEach((row, r) => [...row].forEach((v, c) => {
    if (v === '1' && !(skip && skip.has(r*cols+c))) ctx.fillRect(x+c*cw, y+r*ch, cw+0.5, ch+0.5);
  }));
  ctx.restore();
}

function drawAlien(a) {
  const color = ROW_COLORS[a.row];
  const diving = a.type === 'diver' && a.diveState !== 'idle';
  ctx.save();
  drawSprite(SPRITES[a.type], a.x, a.y, a.w, a.h, color, null, diving ? 20 : 8);
  if (a.type === 'circler') {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowBlur = 6; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(a.x+a.w/2, a.y+a.h/2, a.w*0.75, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawBolt(x, y, w, h, color) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x + w*0.2, y, w*0.6, h*0.35);
  ctx.restore();
}
