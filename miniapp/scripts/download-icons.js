// 下载图标的脚本
// 使用方法：node scripts/download-icons.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const iconsDir = path.join(__dirname, '../src/assets/icons');

// 确保目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 图标 URL（使用免费的图标资源）
// 这里使用一些简单的图标示例
const icons = [
  {
    name: 'home',
    url: 'https://img.icons8.com/ios/81/999999/home.png',
    activeUrl: 'https://img.icons8.com/ios/81/1890FF/home.png'
  },
  {
    name: 'graph',
    url: 'https://img.icons8.com/ios/81/999999/combo-chart.png',
    activeUrl: 'https://img.icons8.com/ios/81/1890FF/combo-chart.png'
  },
  {
    name: 'practice',
    url: 'https://img.icons8.com/ios/81/999999/test.png',
    activeUrl: 'https://img.icons8.com/ios/81/1890FF/test.png'
  },
  {
    name: 'profile',
    url: 'https://img.icons8.com/ios/81/999999/user.png',
    activeUrl: 'https://img.icons8.com/ios/81/1890FF/user.png'
  }
];

// 下载文件
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // 删除不完整的文件
      reject(err);
    });
  });
}

// 主函数
async function main() {
  console.log('下载图标...\n');

  for (const icon of icons) {
    try {
      // 下载未选中状态图标
      const normalPath = path.join(iconsDir, `${icon.name}.png`);
      await downloadFile(icon.url, normalPath);
      console.log(`✓ 下载 ${icon.name}.png`);

      // 下载选中状态图标
      const activePath = path.join(iconsDir, `${icon.name}-active.png`);
      await downloadFile(icon.activeUrl, activePath);
      console.log(`✓ 下载 ${icon.name}-active.png`);
    } catch (error) {
      console.error(`✗ 下载 ${icon.name} 失败:`, error.message);
    }
  }

  console.log('\n图标下载完成！');
  console.log('\n如果下载失败，请手动下载图标：');
  console.log('1. 访问 https://www.iconfont.cn/ 或其他图标库');
  console.log('2. 下载所需的图标');
  console.log('3. 将图标放入 src/assets/icons/ 目录');
  console.log('\n图标要求：');
  console.log('- 尺寸：81x81 像素');
  console.log('- 格式：PNG');
  console.log('- 背景：透明');
  console.log('- 颜色：未选中 #999999，选中 #1890FF');
}

main().catch(console.error);
