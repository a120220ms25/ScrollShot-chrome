// 使用 Node.js 建立圖標的腳本
// 執行方式: node create-icons.js

const fs = require('fs');
const { createCanvas } = require('canvas');

// 如果沒有安裝 canvas 套件，請先執行: npm install canvas

const sizes = [16, 32, 48, 128];

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 漸層背景
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');

  // 圓角矩形背景
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, size, size, size * 0.2);

  // 繪製相機/截圖圖標
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'white';

  const scale = size / 48;
  const centerX = size / 2;
  const centerY = size / 2;

  // 相機機身
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.roundRect(
    centerX - 12 * scale,
    centerY - 8 * scale,
    24 * scale,
    16 * scale,
    2 * scale
  );
  ctx.stroke();

  // 鏡頭
  ctx.beginPath();
  ctx.arc(centerX, centerY, 6 * scale, 0, Math.PI * 2);
  ctx.fill();

  // 閃光燈
  ctx.fillRect(
    centerX - 8 * scale,
    centerY - 10 * scale,
    4 * scale,
    2 * scale
  );

  return canvas;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// 建立所有尺寸的圖標
sizes.forEach(size => {
  const canvas = createIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const filename = `icons/icon${size}.png`;

  fs.writeFileSync(filename, buffer);
  console.log(`已建立 ${filename}`);
});

console.log('所有圖標建立完成！');
