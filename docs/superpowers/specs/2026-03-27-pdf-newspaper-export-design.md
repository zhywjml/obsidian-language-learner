# PDF 报纸导出功能设计文档

**创建日期**: 2026-03-27
**版本**: v1.0
**状态**: 已确认

---

## 1. 功能概述

为 Obsidian Language Learner 插件添加报纸风格的 PDF 导出功能。用户在阅读模式下可以将文章导出为类似报纸排版的 PDF，左侧 70% 显示文章内容，右侧 30% 显示文章中出现的单词释义。

---

## 2. 核心特性

### 2.1 技术方案

**单页大画布方案**（html2canvas → jsPDF）

- 创建大尺寸 HTML 元素，使用 CSS columns 实现分栏
- html2canvas 截图后使用 jsPDF 生成分页 PDF
- 每页 A4 尺寸，按高度分割

### 2.2 数据来源

- 自动提取阅读模式中高亮的所有单词
- 从插件词库获取单词的完整信息（expression, meaning, phonetic）

### 2.3 文本流向

**对应页式**：每页左侧显示文章片段，右侧显示该页出现的单词释义
- 按页面高度自动分页
- 右侧单词栏只显示当前页出现的单词

### 2.4 触发方式

1. **阅读模式工具栏按钮** - 在阅读界面添加导出图标按钮
2. **Obsidian 命令面板命令** - 命令 `Export to Newspaper PDF`

### 2.5 导出流程

```
触发导出 → 打开设置面板 → 用户配置选项 → 点击导出 → 生成 PDF → 下载
```

导出前弹出设置面板，可编辑：
- 报纸标题
- 选择要包含的单词
- 日期显示

### 2.6 标题来源

- **默认**：使用 Obsidian 文件名
- **手动**：在设置面板可修改
- **自动提取**：可选使用文章第一个 H1 标题

### 2.7 视觉风格

**古典报纸风格**
- 衬线字体（思源宋体）
- 装饰边框
- 传统分栏线
- 米白色旧报纸背景色

### 2.8 单词释义格式

**标准版**：单词 / 音标 / 含义

示例：
```
apple /ˈæpl/
苹果；苹果树
```

### 2.9 字体方案

**内置精简字体**
- 思源宋体（Source Han Serif）
- 仅包含常用汉字（约 3500 字）+ ASCII
- 控制字体文件大小在 500KB 以内

---

## 3. 组件架构

### 3.1 组件结构

```
PdfExportPanel (Vue 组件)
├── 标题输入框
├── 副标题输入框（可选）
├── 单词筛选器
│   ├── 全部单词
│   ├── 仅高亮单词
│   ├── 仅学习中单词
│   └── 手动选择
├── 单词列表（带复选框）
├── 选项设置
│   ├── 显示音标
│   └── 显示日期
├── 预览按钮
└── 导出按钮

PdfExportService (服务类)
├── scanArticleWords()      - 扫描文章中的单词
├── renderNewspaperLayout() - 渲染报纸布局 HTML
├── captureToCanvas()       - html2canvas 截图
├── splitToPages()          - 按 A4 高度分割页面
└── generatePDF()           - jsPDF 生成 PDF

NewspaperRenderer (渲染器)
├── generateHeader()        - 生成报纸标题区
├── generateArticleColumn() - 生成文章栏内容
├── generateWordColumn()    - 生成单词栏内容
├── applyNewspaperStyles()  - 应用报纸样式
└── createHiddenContainer() - 创建隐藏渲染容器
```

### 3.2 文件结构

```
src/
├── views/
│   └── PdfExportPanel.vue      # 导出设置面板
├── services/
│   └── pdf-export.service.ts   # PDF 导出服务
├── utils/
│   ├── newspaper.renderer.ts   # 报纸渲染器
│   └── font.loader.ts          # 字体加载工具
├── assets/
│   └── fonts/
│       └── SourceHanSerifCN-Regular.woff2  # 内置字体
└── styles/
    └── newspaper.css           # 报纸样式
```

---

## 4. 数据流

```
1. 用户触发导出
   ↓
2. 打开 PdfExportPanel
   ↓
3. 自动扫描当前阅读内容
   - 获取 DOM 中的高亮单词
   - 从数据库查询单词详情
   ↓
4. 用户配置导出选项
   - 修改标题
   - 选择单词
   - 设置选项
   ↓
5. 点击导出按钮
   - 调用 PdfExportService
   ↓
6. 生成报纸布局 HTML
   - 创建隐藏容器
   - 渲染报纸结构
   - 应用 CSS 样式
   ↓
7. html2canvas 截图
   - 配置高清截图 (scale: 2)
   - 生成大 canvas
   ↓
8. jsPDF 分页处理
   - 创建 A4 尺寸 PDF
   - 按高度分割大图片
   - 逐页添加到 PDF
   ↓
9. 触发浏览器下载
   - 文件名: {title}_{date}.pdf
```

---

## 5. 样式设计

### 5.1 页面规格

- **尺寸**: A4 纵向 (210mm × 297mm)
- **分辨率**: 300 DPI (打印质量)
- **页边距**: 15mm

### 5.2 布局结构

```
┌─────────────────────────────────────────────────┐
│  [装饰边框]                                      │
│  ┌─────────────────────────────────────────┐   │
│  │          报纸标题 (大标题)                │   │
│  │          副标题 / 日期                   │   │
│  └─────────────────────────────────────────┘   │
│  ═══════════════════════════════════════════    │
│                                                 │
│  ┌─────────────────────┬──────────────────┐    │
│  │                     │                  │    │
│  │    文章内容         │   单词释义栏     │    │
│  │    (70% 宽度)       │   (30% 宽度)     │    │
│  │                     │                  │    │
│  │  正文文本流...       │   • apple       │    │
│  │                     │     /ˈæpl/      │    │
│  │  段落段落段落...     │     苹果        │    │
│  │                     │                  │    │
│  │                     │   • banana      │    │
│  │                     │     /bəˈnɑːnə/  │    │
│  │                     │     香蕉        │    │
│  │                     │                  │    │
│  └─────────────────────┴──────────────────┘    │
│  [装饰边框]                                      │
└─────────────────────────────────────────────────┘
```

### 5.3 字体规范

| 元素 | 字体 | 字号 | 字重 |
|------|------|------|------|
| 主标题 | Source Han Serif CN | 28pt | Bold |
| 副标题 | Source Han Serif CN | 14pt | Regular |
| 日期 | Source Han Serif CN | 10pt | Regular |
| 正文 | Source Han Serif CN | 12pt | Regular |
| 单词词条 | Source Han Serif CN | 10pt | Regular |
| 音标 | Times New Roman | 9pt | Italic |

### 5.4 颜色方案

```css
:root {
  --paper-bg: #f8f5f0;        /* 米白色旧报纸 */
  --text-primary: #1a1a1a;    /* 正文黑 */
  --text-secondary: #4a4a4a;  /* 次要文字 */
  --border-color: #8b7355;    /* 分割线 */
  --border-dark: #5c4033;     /* 装饰边框 */
  --accent-color: #8b4513;    /* 强调色 */
}
```

### 5.5 装饰元素

1. **顶部标题区**
   - 双边框装饰（外粗内细）
   - 居中对齐
   - 可选装饰图案

2. **分栏线**
   - 单实线 1px
   - 颜色 #8b7355

3. **页脚**
   - 页码显示
   - 装饰性分隔线

---

## 6. 接口设计

### 6.1 PdfExportSettings 接口

```typescript
interface PdfExportSettings {
  /** 报纸主标题 */
  title: string;

  /** 副标题（可选） */
  subtitle?: string;

  /** 报纸日期 */
  date: string;

  /** 单词筛选模式 */
  wordFilter: 'all' | 'highlighted' | 'learning' | 'selected';

  /** 手动选择的单词列表 */
  selectedWords?: string[];

  /** 是否显示音标 */
  showPhonetic: boolean;

  /** 是否显示用户笔记 */
  showNotes: boolean;

  /** 页面主题 */
  theme: 'classic' | 'modern';
}
```

### 6.2 WordEntry 接口

```typescript
interface WordEntry {
  /** 单词 */
  expression: string;

  /** 音标 */
  phonetic?: string;

  /** 含义 */
  meaning: string;

  /** 用户笔记 */
  notes?: string[];

  /** 学习状态 */
  status: number;

  /** 在文章中出现的位置 */
  positions?: number[];
}
```

### 6.3 PdfExportService 类

```typescript
class PdfExportService {
  /**
   * 扫描文章获取单词列表
   */
  async scanArticleWords(
    articleContent: HTMLElement,
    filter: WordFilterType
  ): Promise<WordEntry[]>;

  /**
   * 导出 PDF
   */
  async exportToPDF(
    articleContent: string,
    words: WordEntry[],
    settings: PdfExportSettings
  ): Promise<Blob>;

  /**
   * 预览报纸布局
   */
  async generatePreview(
    articleContent: string,
    words: WordEntry[],
    settings: PdfExportSettings
  ): Promise<string>; // 返回 data URL
}
```

---

## 7. 边界情况处理

### 7.1 长文章处理

- 自动分页，每页独立渲染
- 每页右侧单词栏只显示该页出现的单词
- 最大导出页数限制：20 页（防止内存溢出）

### 7.2 图片处理

- 文章中图片按比例缩放
- 最大宽度不超过栏宽（70% A4 宽度）
- 图片下方添加图注

### 7.3 表格处理

- Markdown 表格转换为简化文本格式
- 或使用等宽字体保持对齐
- 复杂表格可跨栏显示

### 7.4 超长单词释义

- 超过 3 行时截断
- 添加省略号 "..."
- 提示用户查看完整释义

### 7.5 无单词情况

- 右侧单词栏显示 "本页无标注单词"
- 或隐藏右侧栏，左侧扩展为 100%

### 7.6 字体缺失

- 内置字体缺失时降级使用系统字体
- 显示警告提示用户

---

## 8. 性能优化

### 8.1 渲染优化

- 使用 `requestAnimationFrame` 分批渲染
- 图片预加载完成后再截图
- 大图片使用 canvas 缩放优化

### 8.2 内存管理

- 截图后立即释放 DOM 引用
- 使用 Blob URL 而非 data URL 传递大图片
- 每页渲染后清理 canvas

### 8.3 用户反馈

- 导出进度指示器（进度条或步骤提示）
- 预估剩余时间
- 取消按钮（长文章导出时可中断）

---

## 9. 依赖库

### 9.1 核心依赖

```json
{
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.1"
}
```

### 9.2 字体资源

- Source Han Serif CN (思源宋体)
- 仅包含常用字符集（约 3500 字）
- 格式：WOFF2（压缩）

---

## 10. 实现检查清单

### 10.1 前端组件

- [ ] PdfExportPanel.vue - 导出设置面板
- [ ] 阅读模式工具栏添加导出按钮
- [ ] Obsidian 命令注册

### 10.2 核心服务

- [ ] pdf-export.service.ts - 导出服务
- [ ] newspaper.renderer.ts - 报纸渲染器
- [ ] font.loader.ts - 字体加载

### 10.3 样式资源

- [ ] newspaper.css - 报纸样式
- [ ] 内置字体文件

### 10.4 国际化

- [ ] 中文翻译
- [ ] 英文翻译
- [ ] 繁体中文翻译

### 10.5 测试

- [ ] 短文章导出测试
- [ ] 长文章分页测试
- [ ] 特殊字符处理测试
- [ ] 字体加载测试

---

## 11. 后续扩展（可选）

### 11.1 主题扩展

- 夜间模式主题（深色背景）
- 现代杂志风格主题
- 学术论文风格主题

### 11.2 功能扩展

- 批量导出多篇笔记
- 自定义 CSS 样式
- 添加水印
- 页眉页脚自定义

### 11.3 格式扩展

- EPUB 电子书导出
- Word 文档导出
- 图片（PNG/JPG）导出

---

## 12. 参考资源

### 12.1 设计参考

- 华尔街日报排版
- 纽约时报印刷版
- 卫报印刷版

### 12.2 技术参考

- [html2canvas 文档](https://html2canvas.hertzen.com/)
- [jsPDF 文档](https://rawgit.com/MrRio/jsPDF/master/docs/)
- [CSS Columns](https://developer.mozilla.org/zh-CN/docs/Web/CSS/columns)

---

**文档结束**

**下一步**: 调用 `writing-plans` skill 创建详细实现计划
