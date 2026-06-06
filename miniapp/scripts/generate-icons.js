// 生成占位符图标的脚本
// 使用方法：node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../src/assets/icons');

// 确保目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 图标配置
const icons = [
  { name: 'home', label: '🏠' },
  { name: 'graph', label: '📊' },
  { name: 'practice', label: '📝' },
  { name: 'profile', label: '👤' }
];

// 生成简单的 SVG 图标
function generateIconSVG(label, color, size = 81) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" opacity="0.1"/>
  <text x="${size/2}" y="${size/2}" font-family="Arial" font-size="${size/2}" fill="${color}" text-anchor="middle" dominant-baseline="central">${label}</text>
</svg>`;
}

// 生成占位符 PNG（实际上是 SVG，但扩展名是 png）
// 注意：实际项目中应该使用真正的 PNG 图标
console.log('生成占位符图标...\n');

icons.forEach(icon => {
  // 未选中状态
  const normalSVG = generateIconSVG(icon.label, '#999999');
  const normalPath = path.join(iconsDir, `${icon.name}.svg`);
  fs.writeFileSync(normalPath, normalSVG);
  console.log(`✓ 生成 ${icon.name}.svg`);

  // 选中状态
  const activeSVG = generateIconSVG(icon.label, '#1890FF');
  const activePath = path.join(iconsDir, `${icon.name}-active.svg`);
  fs.writeFileSync(activePath, activeSVG);
  console.log(`✓ 生成 ${icon.name}-active.svg`);
});

console.log('\n图标生成完成！');
console.log('\n注意：这些是 SVG 占位符图标。');
console.log('在实际项目中，你需要：');
console.log('1. 将 SVG 转换为 PNG 格式');
console.log('2. 或者使用真正的 PNG 图标文件');
console.log('3. 确保图标尺寸为 81x81 像素');
console.log('\n推荐工具：');
console.log('- 在线 SVG 转 PNG：https://svgtopng.com/');
console.log('- 图标库：https://www.iconfont.cn/');
