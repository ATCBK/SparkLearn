const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const iconTsx = read('miniapp/src/components/AppIcon/index.tsx');
const iconScss = read('miniapp/src/components/AppIcon/index.scss');
const tabBarTsx = read('miniapp/src/components/AppTabBar/index.tsx');
const tabBarScss = read('miniapp/src/components/AppTabBar/index.scss');
const tutorTsx = read('miniapp/src/pages/tutor/index.tsx');

const expectedNames = [
  'bot',
  'sparkles',
  'users',
  'globe',
  'cpu',
  'shield',
  'image',
  'mic',
  'send',
  'plus',
  'book',
  'quiz',
  'user',
  'folder',
];

for (const name of expectedNames) {
  assert(iconTsx.includes(`| '${name}'`), `Missing AppIconName "${name}"`);
}

assert(!tabBarTsx.includes('<AppIcon'), 'Tab bar should not render icons.');
assert(!tabBarTsx.includes("icon:"), 'Tab bar should only keep text labels.');
assert(/\.app-tabbar\s*\{[\s\S]*height:\s*96rpx;/m.test(tabBarScss), 'Tab bar should use the compact text-only height.');
assert(tutorTsx.includes("name='sparkles'"), 'Tutor page should keep sparkles icon usage.');
assert(tutorTsx.includes("name='globe'"), 'Tutor page should keep globe icon usage.');
assert(iconTsx.includes('function renderIcon'), 'AppIcon should render miniapp-safe icon structures.');
assert(iconTsx.includes("className={`app-icon app-icon--${name} ${className}`.trim()}"), 'AppIcon should expose a per-icon class name.');
assert(iconTsx.includes("case 'bot':"), 'AppIcon should define the bot icon structure.');
assert(!iconTsx.includes('<svg'), 'AppIcon should not rely on inline SVG in the miniapp runtime.');
assert(iconScss.includes('.app-icon__canvas'), 'AppIcon styles should define the positioning canvas.');
assert(iconScss.includes('.app-icon__outline'), 'AppIcon styles should define outline primitives.');

console.log('PASS test_app_icon_contract');
