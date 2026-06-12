const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testTutorPageCompatibilityAndLayout() {
  const tutorTsx = read('miniapp/src/pages/tutor/index.tsx');
  const tutorScss = read('miniapp/src/pages/tutor/index.scss');

  assert(!tutorTsx.includes('enhanced '), 'Tutor page should not use ScrollView enhanced mode in WebView rendering mode.');
  assert(!tutorTsx.includes(' enhanced'), 'Tutor page should not use ScrollView enhanced mode in WebView rendering mode.');

  assert(
    /\.composer\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*calc\(112rpx \+ env\(safe-area-inset-bottom\)\);/m.test(tutorScss),
    'Composer should be fixed above the tab bar using the safe-area-aware bottom offset.'
  );

  assert(
    /\.tutor-scroll\s*\{[\s\S]*padding-bottom:\s*420rpx;/m.test(tutorScss),
    'Tutor scroll area should reserve enough bottom space for the fixed composer.'
  );

  assert(
    /\.tutor-page\s*\{[\s\S]*background:\s*linear-gradient\(/m.test(tutorScss),
    'Tutor page should define an explicit light background gradient.'
  );
}

try {
  testTutorPageCompatibilityAndLayout();
  console.log('PASS test_tutor_layout');
} catch (error) {
  console.error(`FAIL test_tutor_layout: ${error.message}`);
  process.exit(1);
}
