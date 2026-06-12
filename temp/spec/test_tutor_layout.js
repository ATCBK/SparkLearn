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
    /\.composer\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*calc\(96rpx \+ env\(safe-area-inset-bottom\)\);/m.test(tutorScss),
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

  assert(tutorTsx.includes('const quickQuestions = ['), 'Tutor page should define fixed quick questions.');
  assert(tutorTsx.includes('const hasConversationMessages ='), 'Tutor page should compute empty vs chat state.');
  assert(tutorTsx.includes("className='quick-question-list'"), 'Tutor empty state should render quick question list.');
  assert(tutorTsx.includes('onClick={() => void handleQuickQuestionAsk(item)}'), 'Quick questions should send directly.');
  assert(/\.quick-question-list\s*\{[\s\S]*display:\s*flex;/m.test(tutorScss), 'Tutor styles should define quick question list layout.');
  assert(!tutorTsx.includes("className='mode-strip-scroll'"), 'Tutor page should not render the duplicated top mode strip.');
  assert(!tutorTsx.includes("className='mode-hint'"), 'Tutor page should not render the duplicated top mode hint.');

  assert(tutorTsx.includes('function hasEvidence'), 'Tutor page should gate the evidence entry on available process data.');
  assert(tutorTsx.includes('function assistantContent'), 'Tutor page should render assistant replies as plain content.');
  assert(tutorTsx.includes("className='assistant-evidence'"), 'Tutor page should render collapsed evidence entry.');
  assert(tutorTsx.includes("className='assistant-message__content'"), 'Tutor page should render plain assistant content.');
  assert(tutorTsx.includes('... 查看检索与调用过程'), 'Tutor page should use a lightweight process entry under the answer bubble.');
  assert(!tutorTsx.includes("className='assistant-message__head'"), 'Tutor page should not render assistant identity headers.');
  assert(!tutorTsx.includes("className='assistant-card'"), 'Tutor page should not wrap assistant replies in cards.');
  assert(!tutorTsx.includes('回答依据与过程'), 'Tutor page should not render heavy process heading.');
  assert(/\.assistant-evidence__summary\s*\{[\s\S]*border-radius:\s*18rpx;/m.test(tutorScss), 'Tutor styles should define a lightweight evidence trigger card.');
  assert(/\.assistant-message__content\s*\{[\s\S]*white-space:\s*pre-wrap;/m.test(tutorScss), 'Tutor styles should define plain assistant content layout.');
}

try {
  testTutorPageCompatibilityAndLayout();
  console.log('PASS test_tutor_layout');
} catch (error) {
  console.error(`FAIL test_tutor_layout: ${error.message}`);
  process.exit(1);
}
