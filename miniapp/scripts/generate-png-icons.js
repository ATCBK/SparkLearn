// 生成 PNG 格式图标的脚本
// 使用方法：node scripts/generate-png-icons.js

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../src/assets/icons');

// 确保目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 简单的 PNG 图标生成（1x1 像素的占位符）
// 注意：这些是占位符图标，实际项目中需要使用真正的图标

function createSimplePNG(color) {
  // 创建一个简单的 1x1 像素 PNG 文件
  // PNG 文件头
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData.writeUInt8(8, 8);   // bit depth
  ihdrData.writeUInt8(2, 9);   // color type (RGB)
  ihdrData.writeUInt8(0, 10);  // compression
  ihdrData.writeUInt8(0, 11);  // filter
  ihdrData.writeUInt8(0, 12);  // interlace

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdrChunk = Buffer.alloc(25);
  ihdrChunk.writeUInt32BE(13, 0); // length
  ihdrChunk.write('IHDR', 4);
  ihdrData.copy(ihdrChunk, 8);
  ihdrChunk.writeInt32BE(ihdrCrc, 21);

  // IDAT chunk (compressed image data)
  const rawData = Buffer.from([0, color.r, color.g, color.b]); // filter byte + RGB
  const compressedData = deflate(rawData);

  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressedData]));
  const idatChunk = Buffer.alloc(12 + compressedData.length);
  idatChunk.writeUInt32BE(compressedData.length, 0);
  idatChunk.write('IDAT', 4);
  compressedData.copy(idatChunk, 8);
  idatChunk.writeInt32BE(idatCrc, 8 + compressedData.length);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iendChunk = Buffer.alloc(12);
  iendChunk.writeUInt32BE(0, 0);
  iendChunk.write('IEND', 4);
  iendChunk.writeInt32BE(iendCrc, 8);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 计算
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// CRC32 查找表
const crc32Table = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crc32Table[i] = c;
}

// 简单的 deflate 压缩（无压缩模式）
function deflate(data) {
  // 使用 Node.js 的 zlib 模块
  const zlib = require('zlib');
  return zlib.deflateSync(data);
}

// 图标配置
const icons = [
  { name: 'home', color: { r: 153, g: 153, b: 153 }, activeColor: { r: 24, g: 144, b: 255 } },
  { name: 'graph', color: { r: 153, g: 153, b: 153 }, activeColor: { r: 24, g: 144, b: 255 } },
  { name: 'practice', color: { r: 153, g: 153, b: 153 }, activeColor: { r: 24, g: 144, b: 255 } },
  { name: 'profile', color: { r: 153, g: 153, b: 153 }, activeColor: { r: 24, g: 144, b: 255 } }
];

console.log('生成 PNG 图标...\n');

icons.forEach(icon => {
  try {
    // 未选中状态
    const normalPNG = createSimplePNG(icon.color);
    const normalPath = path.join(iconsDir, `${icon.name}.png`);
    fs.writeFileSync(normalPath, normalPNG);
    console.log(`✓ 生成 ${icon.name}.png`);

    // 选中状态
    const activePNG = createSimplePNG(icon.activeColor);
    const activePath = path.join(iconsDir, `${icon.name}-active.png`);
    fs.writeFileSync(activePath, activePNG);
    console.log(`✓ 生成 ${icon.name}-active.png`);
  } catch (error) {
    console.error(`✗ 生成 ${icon.name} 失败:`, error.message);
  }
});

console.log('\n图标生成完成！');
console.log('\n注意：这些是占位符图标（1x1 像素）。');
console.log('在实际项目中，你需要替换为真正的图标文件。');
console.log('\n推荐方案：');
console.log('1. 使用在线图标库下载图标：https://www.iconfont.cn/');
console.log('2. 使用设计工具（如 Figma、Sketch）创建图标');
console.log('3. 使用 AI 工具生成图标');
console.log('\n图标要求：');
console.log('- 尺寸：81x81 像素');
console.log('- 格式：PNG');
console.log('- 背景：透明');
console.log('- 颜色：未选中 #999999，选中 #1890FF');
