// ---------- background starfield ----------
function drawBackground() {
  ctx.save();
  ctx.strokeStyle = '#ffffff08';
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % W, y = (i * 53) % H;
    ctx.fillStyle = '#ffffff' + (10 + (i%5)*3).toString(16);
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}
