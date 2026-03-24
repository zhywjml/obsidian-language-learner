# Language Learner | 语言学习工具

## 更新日志

### 2026-03-24 (v1.3.1)

**阅读模式图片渲染**
- 新增 Obsidian 图片 wikilink 格式解析（`![[image.jpg]]`）
- 新增 Markdown 图片语法渲染（`![alt](url)`）
- 支持网络图片和本地图片路径智能处理
- 图片居中显示，优化阅读体验

### 2026-03-23 (v1.3.0)

**界面优化**
- 新增插件 UI 语言设置，支持中文/英文切换（默认中文）
- 词典界面适配深色模式，优化在线词典和离线词典在深色主题下的显示效果

**阅读模式 Markdown 渲染**
- 新增标题渲染支持（# ~ ######）
- 新增粗体渲染支持（`**text**` 或 `__text__`）
- 新增斜体渲染支持（`*text*` 或 `_text_`）
- 新增删除线渲染支持（`~~text~~`）
- 新增阅读区样式设置面板，支持调整字号、行距、字距

**功能调整**
- 默认禁用 Ctrl 键查词功能，避免误触发（可在设置中手动启用）
- 修复金山词霸词典图标显示问题

### 2026-03-18

**在线词典优化**
- 新增金山词霸词典，提供更多查词来源
- 移除已失效的句酷词典
- 优化有道词典结果显示布局
- 金山词霸例句和柯林斯区域支持滚动查看，优化长内容显示体验
- 更新金山词霸词典图标，使用高清PNG格式

### 2026-03-17

- 添加 AnkiConnect 集成功能，支持将单词导出到 Anki
- 支持动态获取 Anki 模板字段名，兼容各种 Anki 笔记模板
- 修复 AnkiConnect API 请求格式问题
- 修复离线词典面板显示"未加载"但实际可用的状态显示问题
- 优化离线词典加载状态显示，添加绿色状态指示点
- 将UI统一为Obsidian原生风格，移除naive-ui组件库
- 统一下拉框样式，修复鼠标悬浮消失问题
- 为标签相关UI添加国际化支持

### 2026-03-16

- 修复重启Obsidian后离线词典加载问题
- 优化README离线词典中的信息

### 2026-03-15

- 添加离线MDict词典支持

---

[English](#english) | [中文](#中文)

---

<a name="中文"></a>

## 中文

用 Obsidian 来学习语言！

> ⚠️ **注意**：当前插件还在早期开发阶段，目前仅支持中文母语者学习英文。项目目前仅测试英文环境。本项目正在进一步开发以及维护中。

### 使用指南

- 📖 [文字教程](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/tutorial.pdf)
- 🎬 [视频教程](https://www.bilibili.com/video/BV1914y1Y7mT)
- 📝 [一些做好的文本](https://github.com/guopenghui/language-learner-texts)
- 📺 @emisjerry 制作的使用教程: [Youtube](https://www.youtube.com/watch?v=lK3oFpUg7-o) | [Bilibili](https://www.bilibili.com/video/BV1N24y1k7SL/)

> 💡 感谢原作者 [@guopenghui](https://github.com/guopenghui) 提供的教程资源。

### 功能特性

#### 核心功能

- **查词功能**：直接在笔记中划词查词，支持有道词典、剑桥词典、DeepL 等多个在线词典
- **离线词典**：支持加载本地 MDict 词典文件（.mdx），无需网络即可查词
- **生词管理**：数据保存在 Obsidian 中，每个单词/短语支持多条笔记、多条例句
- **阅读模式**：将每个单词变成可点击按钮，边读边查边记笔记
- **统计图表**：显示学习进度和单词统计
- **Anki 导出**：支持将单词导出到 Anki，配合 AnkiConnect 实现闪卡复习

#### 数据存储

- **Markdown 文件存储**（推荐）：支持 Obsidian Sync，可直接查看编辑
- **IndexedDB 本地存储**：传统存储方式
- **远程服务器存储**：支持自建后端服务器

#### 阅读模式增强

- **一键格式化**：自动为文章添加阅读模式格式标记
- **分页导航**：支持页码跳转和每页段数调整
- **本地音频**：支持在阅读模式下播放本地音频文件
- **样式设置**：可调整字号、行距、字距

#### 本地音频支持

阅读模式下支持播放本地音频文件，边听边读：

1. **格式化文章时设置**：点击侧边栏"格式化为阅读模式"按钮，会弹出音频文件选择器
2. **为已有文章设置**：打开命令面板，搜索"设置文章音频"，选择音频文件
3. **支持格式**：mp3, wav, ogg, m4a, flac, aac, wma
4. **跳过设置**：按 Esc 键可跳过不设置音频

<p align="center">
  <img src="Snipaste_2026-03-14_14-39-25.png" alt="音频播放器界面" width="600">
</p>

#### 离线词典功能

- 支持 MDX 格式词典文件
- 可同时加载多个词典
- 智能模糊匹配和单词建议
- 可设置默认词典（在线/离线）

> ⚠️ **重要提示**：如果将词典文件复制到库目录后无法看到 .mdx 文件，或在插件选择器中找不到词典，请按以下步骤开启文件类型检测：
>
> 1. 打开 Obsidian 设置
> 2. 进入「文件与链接」
> 3. 开启「检测所有文件类型」选项
>
> 详细说明参考：[Obsidian 论坛讨论](https://forum-zh.obsidian.md/t/topic/35297)

#### Anki 导出功能

支持将学习单词导出到 Anki 进行间隔复习：

1. **前提条件**：安装 [AnkiConnect](https://ankiweb.net/shared/info/2055492159) 插件（Anki 插件代码：2055492159）
2. **配置连接**：在插件设置中启用 AnkiConnect，配置主机地址和端口（默认 127.0.0.1:8765）
3. **测试连接**：点击"测试连接"按钮确保 AnkiConnect 正常工作
4. **导出单词**：
   - 打开 Anki 导出面板（侧边栏小飞机图标）
   - 选择目标牌组和笔记模板
   - 按学习状态筛选单词
   - 勾选要导出的单词，点击导出

> 💡 **提示**：支持动态获取模板字段名，自动适配各种 Anki 笔记模板（如 Basic、Cloze、自定义模板等）



<p align="center">
  <img src="Snipaste_2026-03-17_18-33-08.png" alt="AnkiConnect支持" width="600">
</p>


### 界面展示

| 版本号 |                           界面展示                           |
| :----: | :----------------------------------------------------------: |
| v1.0.0 | <img src="image.png" alt="image-20260317191853449" style="zoom: 33%;" /> |
| v1.0.1 | <img src="image-20260317191853449.png" alt="image-20260317191853449" style="zoom: 33%;" /> |


<p align="center">
  <img src="image-1.png" alt="单词列表面板" width="400">
</p>


<p align="center">
  <img src="image-2.png" alt="离线词典面板" width="400">
</p>


### 测试通过的词典

| 序号 | 名称 | 链接 | 效果图 | 状态 |
|------|------|------|--------|------|
| 1 | [英-汉] ◆【牛津高阶学习词典英汉双解第7版】【全新孤雷排版】【2011.7.31】.mdx | [下载](https://mdx.mdict.org/%E6%8C%89%E8%AF%8D%E5%85%B8%E8%AF%AD%E7%A7%8D%E6%9D%A5%E5%88%86%E7%B1%BB/%E8%8B%B1%E8%AF%AD/%E7%B3%BB%E5%88%97%E8%AF%8D%E5%85%B8/%E7%89%9B%E6%B4%A5/%5B%E8%8B%B1-%E6%B1%89%5D%20%E2%97%86%E3%80%90%E7%89%9B%E6%B4%A5%E9%AB%98%E9%98%B6%E5%AD%A6%E4%B9%A0%E8%AF%8D%E5%85%B8%E8%8B%B1%E6%B1%89%E5%8F%8C%E8%A7%A3%E7%AC%AC7%E7%89%88%E3%80%91%E3%80%90%E5%85%A8%E6%96%B0%E5%AD%A4%E9%9B%B7%E6%8E%92%E7%89%88%E3%80%91%E3%80%902011.7.31%E3%80%91.mdx) | <img src="image-20260314154827870.png" alt="image-20260314154827870" style="zoom:50%;" /> | ✅ 通过 |
| 2 | [英-汉] 【2012.7.1】牛津高阶学习词典英汉双解第7版【OALD 8风格重新排版】.mdx | [下载](https://mdx.mdict.org/%E6%8C%89%E8%AF%8D%E5%85%B8%E8%AF%AD%E7%A7%8D%E6%9D%A5%E5%88%86%E7%B1%BB/%E8%8B%B1%E8%AF%AD/%E7%B3%BB%E5%88%97%E8%AF%8D%E5%85%B8/%E7%89%9B%E6%B4%A5/%5B%E8%8B%B1-%E6%B1%89%5D%20%E3%80%902012.7.1%E3%80%91%E7%89%9B%E6%B4%A5%E9%AB%98%E9%98%B6%E5%AD%A6%E4%B9%A0%E8%AF%8D%E5%85%B8%E8%8B%B1%E6%B1%89%E5%8F%8C%E8%A7%A3%E7%AC%AC7%E7%89%88%E3%80%90OALD%208%E9%A3%8E%E6%A0%BC%E9%87%8D%E6%96%B0%E6%8E%92%E7%89%88%E3%80%91.mdx) | <img src="image-20260314154751369.png" alt="image-20260314154751369" style="zoom: 50%;" /> | ✅ 通过 |

> 更多词典可在 [mdx.mdict.org](https://mdx.mdict.org/%E6%8C%89%E8%AF%8D%E5%85%B8%E8%AF%AD%E7%A7%8D%E6%9D%A5%E5%88%86%E7%B1%BB/%E8%8B%B1%E8%AF%AD/%E6%99%AE%E9%80%9A%E8%AF%8D%E5%85%B8/) 获取

### 安装

1. 从 Release 下载压缩包
2. 解压到 `.obsidian/plugins/obsidian-language-learner/` 目录
3. 在 Obsidian 设置中启用插件
4. 配置词典和存储方式

### 自行构建

```bash
# 克隆仓库
git clone https://github.com/guopenghui/obsidian-language-learner.git

# 进入目录
cd obsidian-language-learner

# 安装依赖
npm install

# 构建
npm run build
```

---

<a name="english"></a>

## English

Learn languages with Obsidian!

> ⚠️ **Note**: The plugin is in early development stage. Currently only supports Chinese native speakers learning English. The project has only been tested in English environment. This project is under active development and maintenance.

### Tutorials

- 📖 [Text Tutorial (PDF, Chinese)](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/tutorial.pdf)
- 🎬 [Video Tutorial (Bilibili, Chinese)](https://www.bilibili.com/video/BV1914y1Y7mT)
- 📝 [Sample Texts](https://github.com/guopenghui/language-learner-texts)
- 📺 Tutorial by @emisjerry: [Youtube](https://www.youtube.com/watch?v=lK3oFpUg7-o) | [Bilibili](https://www.bilibili.com/video/BV1N24y1k7SL/)

> 💡 Thanks to the original author [@guopenghui](https://github.com/guopenghui) for providing these tutorial resources.

### Features

#### Core Features

- **Word Lookup**: Select text to search in multiple online dictionaries (Youdao, Cambridge, DeepL, etc.)
- **Offline Dictionary**: Load local MDict dictionary files (.mdx) for offline word lookup
- **Vocabulary Management**: Store words in Obsidian, each word/phrase supports multiple notes and sentences
- **Reading Mode**: Convert each word into a clickable button for easy lookup while reading
- **Statistics**: Display learning progress and word counts
- **Anki Export**: Export words to Anki for spaced repetition via AnkiConnect

#### Data Storage

- **Markdown File Storage** (Recommended): Supports Obsidian Sync, directly viewable and editable
- **IndexedDB Local Storage**: Traditional storage method
- **Remote Server Storage**: Self-hosted backend server support

#### Reading Mode Enhancements

- **One-click Formatting**: Automatically add reading mode format markers
- **Pagination**: Page navigation with adjustable paragraphs per page
- **Local Audio**: Play local audio files in reading mode
- **Style Settings**: Adjust font size, line height, and letter spacing

#### Local Audio Support

Play local audio files while reading:

1. **Set during formatting**: Click "Format for Reading" button, an audio file selector will appear
2. **Set for existing articles**: Open command palette, search "Set Article Audio", select audio file
3. **Supported formats**: mp3, wav, ogg, m4a, flac, aac, wma
4. **Skip setting**: Press Esc to skip audio selection

<!-- Insert image: Audio player interface -->


#### Offline Dictionary Features

- Support MDX format dictionary files
- Load multiple dictionaries simultaneously
- Smart fuzzy matching and word suggestions
- Configurable default dictionary (online/offline)

> ⚠️ **Important**: If you cannot see .mdx files after copying them to your vault, or cannot find dictionaries in the plugin selector, please enable file type detection:
>
> 1. Open Obsidian Settings
> 2. Go to "Files & Links"
> 3. Enable "Detect all file extensions" option
>
> See [Obsidian Forum](https://forum-zh.obsidian.md/t/topic/35297) for details.

#### Anki Export Feature

Export learned words to Anki for spaced repetition:

1. **Prerequisites**: Install [AnkiConnect](https://ankiweb.net/shared/info/2055492159) addon (Addon code: 2055492159)
2. **Configure Connection**: Enable AnkiConnect in plugin settings, configure host and port (default: 127.0.0.1:8765)
3. **Test Connection**: Click "Test Connection" button to ensure AnkiConnect is working
4. **Export Words**:
   - Open Anki Export panel (airplane icon in sidebar)
   - Select target deck and note model
   - Filter words by learning status
   - Select words to export and click Export

> 💡 **Tip**: Dynamic field name detection automatically adapts to various Anki note models (Basic, Cloze, custom models, etc.)

### Screenshots

| Version |                         Screenshots                          |
| :-----: | :----------------------------------------------------------: |
| v1.0.0  | <img src="image.png" alt="image-20260317191853449" style="zoom: 33%;" /> |
| v1.0.1  | <img src="image-20260317191853449.png" alt="image-20260317191853449" style="zoom: 33%;" /> |

<p align="center">
  <img src="image-1.png" alt="Word list panel" width="400">
</p>


<p align="center">
  <img src="image-2.png" alt="Offline dictionary panel" width="400">
</p>



### Tested Dictionaries

| No. | Name | Link | Screenshot | Status |
|-----|------|------|------------|--------|
| 1 | [En-Zh] Oxford Advanced Learner's Dictionary 7th Edition (Bilingual) | [Download](https://mdx.mdict.org/%E6%8C%89%E8%AF%8D%E5%85%B8%E8%AF%AD%E7%A7%8D%E6%9D%A5%E5%88%86%E7%B1%BB/%E8%8B%B1%E8%AF%AD/%E7%B3%BB%E5%88%97%E8%AF%8D%E5%85%B8/%E7%89%9B%E6%B4%A5/%5B%E8%8B%B1-%E6%B1%89%5D%20%E2%97%86%E3%80%90%E7%89%9B%E6%B4%A5%E9%AB%98%E9%98%B6%E5%AD%A6%E4%B9%A0%E8%AF%8D%E5%85%B8%E8%8B%B1%E6%B1%89%E5%8F%8C%E8%A7%A3%E7%AC%AC7%E7%89%88%E3%80%91%E3%80%90%E5%85%A8%E6%96%B0%E5%AD%A4%E9%9B%B7%E6%8E%92%E7%89%88%E3%80%91%E3%80%902011.7.31%E3%80%91.mdx) | <img src="image-20260314154827870.png" alt="image-20260314154827870" style="zoom:50%;" /> | ✅ Passed |
| 2 | [En-Zh] Oxford Advanced Learner's Dictionary 7th Edition (OALD 8 Style) | [Download](https://mdx.mdict.org/%E6%8C%89%E8%AF%8D%E5%85%B8%E8%AF%AD%E7%A7%8D%E6%9D%A5%E5%88%86%E7%B1%BB/%E8%8B%B1%E8%AF%AD/%E7%B3%BB%E5%88%97%E8%AF%8D%E5%85%B8/%E7%89%9B%E6%B4%A5/%5B%E8%8B%B1-%E6%B1%89%5D%20%E3%80%902012.7.1%E3%80%91%E7%89%9B%E6%B4%A5%E9%AB%98%E9%98%B6%E5%AD%A6%E4%B9%A0%E8%AF%8D%E5%85%B8%E8%8B%B1%E6%B1%89%E5%8F%8C%E8%A7%A3%E7%AC%AC7%E7%89%88%E3%80%90OALD%208%E9%A3%8E%E6%A0%BC%E9%87%8D%E6%96%B0%E6%8E%92%E7%89%88%E3%80%91.mdx) | <img src="image-20260314154751369.png" alt="image-20260314154751369" style="zoom: 50%;" /> | ✅ Passed |

> More dictionaries available at [mdx.mdict.org](https://mdx.mdict.org/%E6%8C%89%E8%AF%8D%E5%85%B8%E8%AF%AD%E7%A7%8D%E6%9D%A5%E5%88%86%E7%B1%BB/%E8%8B%B1%E8%AF%AD/%E6%99%AE%E9%80%9A%E8%AF%8D%E5%85%B8/)

### Installation

1. Download the release package
2. Extract to `.obsidian/plugins/obsidian-language-learner/` directory
3. Enable the plugin in Obsidian settings
4. Configure dictionaries and storage options

### Build from Source

```bash
# Clone the repository
git clone https://github.com/guopenghui/obsidian-language-learner.git

# Navigate to directory
cd obsidian-language-learner

# Install dependencies
npm install

# Build
npm run build
```

---

## Acknowledgments | 致谢

本项目基于以下开源项目开发：

### Core Projects | 核心项目

- [obsidian-language-learner](https://github.com/guopenghui/obsidian-language-learner) - Original plugin by @guopenghui
- [js-mdict](https://github.com/terasum/js-mdict) - MDict (.mdx/.mdd) file parser by @terasum

### Frameworks & Libraries | 框架与库

- [Obsidian](https://obsidian.md/) - The note-taking app
- [Vue 3](https://vuejs.org/) - Progressive JavaScript framework
- [Naive UI](https://www.naiveui.com/) - Vue 3 component library
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [ECharts](https://echarts.apache.org/) - Charting library
- [unified](https://unifiedjs.com/) - Text processing ecosystem

### Special Thanks | 特别感谢

- [@guopenghui](https://github.com/guopenghui) - 原插件作者
- [@terasum](https://github.com/terasum) - js-mdict 项目作者
- [@asa-world](https://github.com/asa-world/obsidian-language-learner) - 阅读模式 Markdown 渲染功能参考
- [Claude Code](https://claude.ai/code) - AI 编程助手
- [glm-5](https://bigmodel.cn/) - 智谱 AI 大模型
- All dictionary providers and the MDict community
- Everyone who contributed to this project

---

## License | 许可证

MIT License