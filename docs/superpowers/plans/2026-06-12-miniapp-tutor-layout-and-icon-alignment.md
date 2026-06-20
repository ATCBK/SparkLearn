# Miniapp Tutor Layout And Icon Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the miniapp icon system to the web platform's Lucide-style semantics and rebuild the miniapp tutor page into a two-state quick-start/chat layout without changing the tab structure.

**Architecture:** Keep `miniapp/src/components/AppIcon` as the single icon entry point, but redraw its glyphs around Lucide-like line icons and reuse that entry point everywhere. Rework `miniapp/src/pages/tutor/index.tsx` so empty state and message state share one fixed composer while process metadata collapses under each assistant message instead of living in separate heavy cards.

**Tech Stack:** Taro 4, React 18, TypeScript, SCSS, Node-based regression scripts

---

## File Map

### Existing files to modify

- `miniapp/src/components/AppIcon/index.tsx`
  Responsibility: central icon component API and supported icon names.
- `miniapp/src/components/AppIcon/index.scss`
  Responsibility: icon glyph drawing rules and shared size/stroke behavior.
- `miniapp/src/components/AppTabBar/index.tsx`
  Responsibility: bottom tab item icon mapping.
- `miniapp/src/pages/tutor/index.tsx`
  Responsibility: tutor page state handling, empty/chat rendering, mode toggles, composer actions.
- `miniapp/src/pages/tutor/index.scss`
  Responsibility: tutor page layout, empty state, chat state, fixed composer, metadata expansion.
- `temp/spec/test_tutor_layout.js`
  Responsibility: regression checks for tutor page structure and fixed layout.

### New files to create

- `temp/spec/test_app_icon_contract.js`
  Responsibility: static regression checks for icon names and tutor/tab usage wiring.

## Task 1: Lock The Icon Contract

**Files:**
- Create: `temp/spec/test_app_icon_contract.js`
- Modify: `miniapp/src/components/AppIcon/index.tsx`
- Test: `temp/spec/test_app_icon_contract.js`

- [ ] **Step 1: Write the failing test**

```js
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const iconTsx = read('miniapp/src/components/AppIcon/index.tsx');
const tabBarTsx = read('miniapp/src/components/AppTabBar/index.tsx');
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

assert(tabBarTsx.includes("icon: 'bot'"), 'Tutor tab icon should stay wired to bot.');
assert(tabBarTsx.includes("icon: 'quiz'"), 'Quiz tab icon should stay wired to quiz.');
assert(tabBarTsx.includes("icon: 'user'"), 'Mine tab icon should stay wired to user.');
assert(tutorTsx.includes("name='sparkles'"), 'Tutor page should keep sparkles icon usage.');
assert(tutorTsx.includes("name='globe'"), 'Tutor page should keep globe icon usage.');

console.log('PASS test_app_icon_contract');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node temp/spec/test_app_icon_contract.js`

Expected: FAIL because the file does not exist yet.

- [ ] **Step 3: Add the test file**

Create `temp/spec/test_app_icon_contract.js` with the exact code from Step 1.

- [ ] **Step 4: Run test to verify it passes on current icon API**

Run: `node temp/spec/test_app_icon_contract.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add temp/spec/test_app_icon_contract.js
git commit -m "test: add miniapp icon contract regression"
```

## Task 2: Rebuild AppIcon To Match Lucide-Style Semantics

**Files:**
- Modify: `miniapp/src/components/AppIcon/index.tsx`
- Modify: `miniapp/src/components/AppIcon/index.scss`
- Test: `temp/spec/test_app_icon_contract.js`

- [ ] **Step 1: Write the failing style regression**

Add these assertions to `temp/spec/test_app_icon_contract.js`:

```js
const iconScss = read('miniapp/src/components/AppIcon/index.scss');

assert(iconScss.includes('.app-icon svg'), 'AppIcon styles should target SVG rendering.');
assert(iconScss.includes('stroke: currentColor;'), 'AppIcon SVG should inherit currentColor stroke.');
assert(iconTsx.includes('const icons'), 'AppIcon should map names to icon descriptors.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node temp/spec/test_app_icon_contract.js`

Expected: FAIL because the current AppIcon implementation is CSS-drawn and has no SVG contract.

- [ ] **Step 3: Replace the AppIcon implementation with SVG path descriptors**

Update `miniapp/src/components/AppIcon/index.tsx` to a descriptor-driven SVG renderer:

```tsx
import { View } from '@tarojs/components'
import './index.scss'

export type AppIconName =
  | 'bot'
  | 'sparkles'
  | 'users'
  | 'globe'
  | 'cpu'
  | 'shield'
  | 'image'
  | 'mic'
  | 'send'
  | 'plus'
  | 'book'
  | 'quiz'
  | 'user'
  | 'folder'

type AppIconProps = {
  name: AppIconName
  className?: string
}

type IconDescriptor = {
  paths: Array<{
    d?: string
    cx?: number
    cy?: number
    r?: number
    fill?: boolean
  }>
}

const icons: Record<AppIconName, IconDescriptor> = {
  plus: { paths: [{ d: 'M12 5v14' }, { d: 'M5 12h14' }] },
  send: { paths: [{ d: 'm5 12 14-7-4 14-2-5-8-2Z' }] },
  mic: { paths: [{ d: 'M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Z' }, { d: 'M7 11a5 5 0 0 0 10 0' }, { d: 'M12 16v4' }] },
  image: { paths: [{ d: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z' }, { d: 'm8 14 2.5-2.5L15 16l2-2 3 3' }, { cx: 9, cy: 9, r: 1.25, fill: true }] },
  shield: { paths: [{ d: 'M12 3 6 5.5V11c0 4 2.5 7 6 9 3.5-2 6-5 6-9V5.5Z' }] },
  globe: { paths: [{ d: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Z' }, { d: 'M3 12h18' }, { d: 'M12 3a14 14 0 0 1 0 18' }, { d: 'M12 3a14 14 0 0 0 0 18' }] },
  cpu: { paths: [{ d: 'M8 8h8v8H8Z' }, { d: 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3' }] },
  sparkles: { paths: [{ d: 'M12 3 13.8 8.2 19 10 13.8 11.8 12 17 10.2 11.8 5 10l5.2-1.8Z' }, { d: 'M5 4v3' }, { d: 'M3.5 5.5h3' }] },
  users: { paths: [{ d: 'M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z' }, { d: 'M17 12a2.5 2.5 0 1 0 0-5' }, { d: 'M4.5 18a4.5 4.5 0 0 1 9 0' }, { d: 'M15 18a3.5 3.5 0 0 0-2.2-3.3' }] },
  bot: { paths: [{ d: 'M9 3h6' }, { d: 'M12 3v3' }, { d: 'M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z' }, { cx: 10, cy: 12, r: 1, fill: true }, { cx: 14, cy: 12, r: 1, fill: true }] },
  book: { paths: [{ d: 'M6 5.5A2.5 2.5 0 0 1 8.5 3H18v15h-9.5A2.5 2.5 0 0 0 6 20.5Z' }, { d: 'M6 5.5V20.5' }] },
  quiz: { paths: [{ d: 'M9 11l2 2 4-4' }, { d: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z' }] },
  user: { paths: [{ d: 'M12 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8Z' }, { d: 'M5 20a7 7 0 0 1 14 0' }] },
  folder: { paths: [{ d: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z' }] },
}

export default function AppIcon({ name, className = '' }: AppIconProps) {
  const icon = icons[name]

  return (
    <View className={`app-icon ${className}`.trim()}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {icon.paths.map((path, index) =>
          path.d ? (
            <path key={`${name}-path-${index}`} d={path.d} className={path.fill ? 'is-fill' : ''} />
          ) : (
            <circle key={`${name}-circle-${index}`} cx={path.cx} cy={path.cy} r={path.r} className={path.fill ? 'is-fill' : ''} />
          ),
        )}
      </svg>
    </View>
  )
}
```

- [ ] **Step 4: Replace the CSS drawing rules with SVG styling**

Update `miniapp/src/components/AppIcon/index.scss` to:

```scss
.app-icon {
  display: inline-flex;
  width: 32rpx;
  height: 32rpx;
  flex: 0 0 32rpx;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.app-icon svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.app-icon .is-fill {
  fill: currentColor;
  stroke: none;
}
```

- [ ] **Step 5: Run tests to verify the new contract passes**

Run: `node temp/spec/test_app_icon_contract.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add miniapp/src/components/AppIcon/index.tsx miniapp/src/components/AppIcon/index.scss temp/spec/test_app_icon_contract.js
git commit -m "feat: align miniapp app icons with web icon semantics"
```

## Task 3: Rebuild Tutor Empty State Around Quick Questions

**Files:**
- Modify: `miniapp/src/pages/tutor/index.tsx`
- Modify: `miniapp/src/pages/tutor/index.scss`
- Modify: `temp/spec/test_tutor_layout.js`
- Test: `temp/spec/test_tutor_layout.js`

- [ ] **Step 1: Extend the tutor regression test for dual-state layout**

Add these assertions to `temp/spec/test_tutor_layout.js`:

```js
assert(tutorTsx.includes('const quickQuestions = ['), 'Tutor page should define fixed quick questions.');
assert(tutorTsx.includes('const hasConversationMessages ='), 'Tutor page should compute empty vs chat state.');
assert(tutorTsx.includes("className='quick-question-list'"), 'Tutor empty state should render quick question list.');
assert(tutorTsx.includes('onClick={() => void handleQuickQuestionAsk(item)}'), 'Quick questions should send directly.');
assert(/\.quick-question-list\s*\{[\s\S]*display:\s*flex;/m.test(tutorScss), 'Tutor styles should define quick question list layout.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node temp/spec/test_tutor_layout.js`

Expected: FAIL because the tutor page does not yet define quick question layout.

- [ ] **Step 3: Add quick question data and dual-state computation**

In `miniapp/src/pages/tutor/index.tsx`, add:

```tsx
const quickQuestions = [
  '帮我梳理这章最重要的 3 个知识点',
  '根据我现在的情况推荐今天先学什么',
  '把这个知识点讲到我能马上做题',
  '给我 3 个最容易混淆的考点提醒',
]
```

and inside `TutorPage` add:

```tsx
const conversationMessages = messages.filter((message) => message.id !== 'welcome')
const hasConversationMessages = conversationMessages.length > 0
```

also add:

```tsx
const handleQuickQuestionAsk = async (text: string) => {
  if (streaming) return
  setQuestion(text)
  await Promise.resolve()
  setTimeout(() => {
    setQuestion(text)
    void handleSendWithText(text)
  }, 0)
}
```

and extract `handleSendWithText(text: string)` from the current `handleSend`.

- [ ] **Step 4: Render empty state instead of the message list when there are no real messages**

Replace the unconditional message `ScrollView` rendering with:

```tsx
{hasConversationMessages ? (
  <ScrollView scrollY showScrollbar={false} className='tutor-scroll' scrollIntoView={lastAssistant?.id}>
    <View className='message-stack'>
      {messages.filter((message) => message.id !== 'welcome').map(/* existing message rendering */)}
    </View>
  </ScrollView>
) : (
  <View className='tutor-empty-state'>
    <View className='tutor-empty-state__hero'>
      <View className='tutor-empty-state__badge'>
        <AppIcon name='sparkles' className='tutor-empty-state__badge-icon' />
      </View>
      <Text className='tutor-empty-state__title'>AI助学</Text>
      <Text className='tutor-empty-state__subtitle'>直接提问，或点一个快捷问题马上开始。</Text>
    </View>

    <View className='quick-question-list'>
      {quickQuestions.map((item) => (
        <View
          key={item}
          className='quick-question-chip'
          hoverClass='tap-active'
          onClick={() => void handleQuickQuestionAsk(item)}
        >
          <Text>{item}</Text>
        </View>
      ))}
    </View>
  </View>
)}
```

- [ ] **Step 5: Add the empty-state styles**

Append focused styles in `miniapp/src/pages/tutor/index.scss`:

```scss
.tutor-empty-state {
  display: flex;
  min-height: calc(100vh - 540rpx);
  flex-direction: column;
  justify-content: center;
  padding: 40rpx 8rpx 0;
}

.tutor-empty-state__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.tutor-empty-state__badge {
  display: grid;
  width: 88rpx;
  height: 88rpx;
  place-items: center;
  border-radius: 24rpx;
  background: #eaf3ff;
  color: #2563eb;
}

.tutor-empty-state__title {
  margin-top: 28rpx;
  color: #111827;
  font-size: 56rpx;
  font-weight: 800;
}

.tutor-empty-state__subtitle {
  margin-top: 14rpx;
  color: #64748b;
  font-size: 26rpx;
  line-height: 1.6;
}

.quick-question-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
  margin-top: 40rpx;
}

.quick-question-chip {
  max-width: 320rpx;
  padding: 18rpx 22rpx;
  color: #334155;
  font-size: 24rpx;
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.96);
  border: 1rpx solid #dbe7f5;
  border-radius: 18rpx;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node temp/spec/test_tutor_layout.js`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add miniapp/src/pages/tutor/index.tsx miniapp/src/pages/tutor/index.scss temp/spec/test_tutor_layout.js
git commit -m "feat: add tutor empty state quick questions"
```

## Task 4: Collapse Tutor Process Metadata Under Each Assistant Message

**Files:**
- Modify: `miniapp/src/pages/tutor/index.tsx`
- Modify: `miniapp/src/pages/tutor/index.scss`
- Modify: `temp/spec/test_tutor_layout.js`
- Test: `temp/spec/test_tutor_layout.js`

- [ ] **Step 1: Add a failing regression for collapsed metadata summaries**

Add these assertions to `temp/spec/test_tutor_layout.js`:

```js
assert(tutorTsx.includes('function buildEvidenceSummary'), 'Tutor page should build a lightweight evidence summary.');
assert(tutorTsx.includes("className='assistant-evidence'"), 'Tutor page should render collapsed evidence entry.');
assert(!tutorTsx.includes('details-panel__title\'>回答依据与过程'), 'Tutor page should not render heavy process heading.');
assert(/\.assistant-evidence\s*\{[\s\S]*font-size:\s*22rpx;/m.test(tutorScss), 'Tutor styles should define lightweight evidence row.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node temp/spec/test_tutor_layout.js`

Expected: FAIL because the existing page still renders the old heavy details panel structure.

- [ ] **Step 3: Add a helper that summarizes citations, MCP calls, and workshop items**

In `miniapp/src/pages/tutor/index.tsx`, add:

```tsx
function buildEvidenceSummary(message: TutorMessage) {
  const parts: string[] = []
  if (message.citations?.length) parts.push(`引用 ${message.citations.length}`)
  if (message.mcpCalls?.length) parts.push(`MCP ${message.mcpCalls.length}`)
  if (message.workshop?.length) parts.push(`研讨会 ${message.workshop.length}`)
  return parts.join(' · ')
}
```

- [ ] **Step 4: Replace the current heavy process section with a lightweight expandable row**

Inside the assistant message rendering, replace the current process block with:

```tsx
{buildEvidenceSummary(message) ? (
  <View className='assistant-evidence'>
    <View
      className='assistant-evidence__summary'
      onClick={() => setExpandedMessageId((value) => (value === message.id ? '' : message.id))}
    >
      <Text className='assistant-evidence__summary-text'>{buildEvidenceSummary(message)} · ...</Text>
      <Text className='assistant-evidence__summary-action'>{expandedMessageId === message.id ? '收起' : '展开'}</Text>
    </View>

    {expandedMessageId === message.id ? (
      <View className='assistant-evidence__body'>
        {/* existing citation/mcp/workshop detail groups reused here */}
      </View>
    ) : null}
  </View>
) : null}
```

- [ ] **Step 5: Replace the heavy card styling with lightweight inline metadata styling**

Add targeted styles:

```scss
.assistant-evidence {
  margin-top: 18rpx;
}

.assistant-evidence__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 12rpx 0;
}

.assistant-evidence__summary-text {
  color: #64748b;
  font-size: 22rpx;
  line-height: 1.5;
}

.assistant-evidence__summary-action {
  flex: 0 0 auto;
  color: #2563eb;
  font-size: 22rpx;
  font-weight: 700;
}

.assistant-evidence__body {
  margin-top: 10rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 16rpx 18rpx;
  background: #f8fbff;
  border: 1rpx solid #e5edf7;
  border-radius: 18rpx;
}
```

- [ ] **Step 6: Run regression tests**

Run: `node temp/spec/test_tutor_layout.js`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add miniapp/src/pages/tutor/index.tsx miniapp/src/pages/tutor/index.scss temp/spec/test_tutor_layout.js
git commit -m "feat: collapse tutor process metadata under messages"
```

## Task 5: Verify End-To-End Build Safety

**Files:**
- Test: `temp/spec/test_app_icon_contract.js`
- Test: `temp/spec/test_tutor_layout.js`

- [ ] **Step 1: Run icon contract regression**

Run: `node temp/spec/test_app_icon_contract.js`

Expected: PASS

- [ ] **Step 2: Run tutor layout regression**

Run: `node temp/spec/test_tutor_layout.js`

Expected: PASS

- [ ] **Step 3: Run miniapp build**

Run: `npm run build:weapp`

Working directory: `miniapp`

Expected: `Compiled successfully`

- [ ] **Step 4: Inspect git diff**

Run: `git diff -- miniapp/src/components/AppIcon miniapp/src/components/AppTabBar miniapp/src/pages/tutor temp/spec`

Expected: only icon-system and tutor-layout related changes.

- [ ] **Step 5: Commit**

```bash
git add miniapp/src/components/AppIcon miniapp/src/components/AppTabBar miniapp/src/pages/tutor temp/spec
git commit -m "feat: align miniapp icons and rebuild tutor layout"
```
