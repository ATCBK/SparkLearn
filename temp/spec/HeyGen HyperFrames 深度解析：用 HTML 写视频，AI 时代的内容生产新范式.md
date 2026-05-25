# HeyGen HyperFrames 深度解析：用 HTML 写视频，AI 时代的内容生产新范式

发布时间：2026年4月17日 21:26

传统短视频制作普遍存在效率痛点：制作1分钟短视频，从写脚本到最终导出，往往要耗费数小时甚至一整天；剪辑软件操作复杂，AI生成文案速度快，但“把想法变成视频”始终是内容生产的核心瓶颈。

## 一、HyperFrames 是什么

HyperFrames 是 HeyGen 在 2025 年开源的视频渲染框架，核心理念为\*\*Write HTML\. Render video\. Built for agents\*\*。

无需掌握 After Effects、Premiere，甚至不用会 React，只要具备网页编写能力，就能制作可渲染成 MP4 的视频。

项目定位：面向开发者和 AI Agent 的\*\*程序化视频生产引擎\*\*，而非面向人类设计师的剪辑软件。

## 二、传统程序化视频方案的不足

1. **Remotion（React 方案）**：AI 不天然懂 React，编写代码需查文档、试错，效率低；团队不熟 React 则入门成本高。

2. **云端 API**：操作简单，但属于黑盒模式、不可控、按量付费，无法实现高度定制化的动画与视觉风格。

HyperFrames 提供第三条路径：用 AI 精通的 HTML\+CSS\+JS，在本地完成高质量、可复现、完全可控的视频生产。

## 三、使用方法

编写带 \`data\-\*\` 属性的 HTML，定义视频画布、素材、出现时间、时长、音轨等参数，仅需两条命令即可完成操作：

```bash
npx hyperframes preview # 浏览器实时预览
npx hyperframes render # 导出 MP4 视频
```

HTML 示例：

```html
<div id="stage" data-composition-id="my-video" data-start="0" data-width="1920" data-height="1080">
<video id="clip-1" data-start="0" data-duration="5" data-track-index="0" src="intro.mp4" muted></video>
<img id="overlay" data-start="2" data-duration="3" data-track-index="1" src="logo.png" />
<audio id="bg-music" data-start="0" data-duration="9" data-track-index="2" data-volume="0.5" src="music.wav"></audio>
</div>
```

## 四、核心架构（六大包分工）

HyperFrames 为 monorepo 结构，核心由六个包构成：

1. **hyperframes（CLI）**：用户直接交互层，包含预览、渲染、代码检查、环境诊断、语音转字幕、文字转语音等命令。

2. **@hyperframes/core**：负责 HTML 解析、代码生成、指令翻译，将用户代码转为引擎可识别的渲染指令。

3. **@hyperframes/engine**：视频渲染核心，基于 Puppeteer 无头浏览器捕获画面，通过 FFmpeg 编码，支持精准跳帧渲染。

4. **@hyperframes/producer**：视频生产流水线控制器，统筹画面捕获、音频混合、并行调度、编码拼接全流程。

5. **@hyperframes/studio**：浏览器端可视化编辑器，支持拖拽素材、调整时间轴，降低手写代码门槛。

6. **@hyperframes/player**：可嵌入网页的播放组件，让视频支持浏览器内播放与交互。

架构亮点：core 与 engine 解耦、动画引擎与捕获引擎解耦，兼容 GSAP、Lottie、CSS Animation、Three\.js 等多种动画技术。

## 五、AI Agent 原生设计（核心差异化）

HyperFrames 专为 AI Agent 打造，仓库自带 5 套技能包，可直接在 Claude Code、Cursor、Codex、Gemini CLI 中调用：

- /hyperframes：指导 AI 编写视频构图、字幕、音画同步代码

- /hyperframes\-cli：指导 AI 使用 CLI 命令

- /hyperframes\-registry：指导 AI 管理组件库

- /gsap：指导 AI 编写 GSAP 动画

- /website\-to\-hyperframes：网页直接转视频

优势：AI 只需掌握 HTML（大模型最擅长的技能），代码生成准确率远高于需适配 React 的 Remotion。

## 六、组件生态

官方维护组件市场，提供\*\*50\+ 开箱即用预设组件\*\*，涵盖社交媒体叠加层、数据可视化图表、WebGL 转场特效等，一键安装即可使用，大幅降低非设计师制作专业视频的难度。

安装示例：

```bash
npx hyperframes add instagram-follow
npx hyperframes add data-chart
npx hyperframes add flash-through-white
```

## 七、优缺点与适用场景

### 适用人群/场景

- 需要批量、自动化生成视频的内容团队

- 想把 AI 工作流延伸至视频产出的开发者

- 有网页开发能力、不想学复杂剪辑软件的人群

- 追求确定性输出、需集成 CI/CD 的企业场景

### 核心优势

- Agent 友好：HTML 是 AI 母语，代码生成准确率高

- 本地渲染：无需云账号、API Key，不按秒付费

- 确定性输出：相同输入固定输出，适配自动化流程

- 框架无关：动画引擎可自由替换，不绑定单一技术栈

- 开源免费：采用 Apache 2\.0 协议，商用无压力

### 局限

- 无网页基础者存在入门门槛

- 本地渲染依赖 FFmpeg 和 Chrome，环境配置偶有问题（可通过 CLI 医生命令一键诊断）

- 生态处于早期，部分高级特效需自主开发

## 八、总结

HyperFrames 不只是代码做视频的工具，更是 HeyGen 对 AI 时代内容生产的前瞻布局：未来视频生产将从人类手动剪辑，转向 **AI Agent 自动读取素材、编排、批量渲染** 的新模式。

它让视频成为可版本控制、可自动化、可被 AI 理解的代码资产，适合搭配 Claude Code、Cursor 等 AI 工具使用。

项目仓库地址：https://github\.com/heygen\-com/hyperframes

> （注：文档部分内容可能由 AI 生成）
