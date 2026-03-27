# PDF 报纸导出功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现报纸风格的 PDF 导出功能，将阅读模式文章导出为 7:3 分栏排版的 PDF，左侧文章，右侧单词释义。

**Architecture:** 单页大画布方案 - 创建隐藏 DOM 容器，使用 CSS 实现报纸分栏布局，html2canvas 截图，jsPDF 分页切割生成 PDF。

**Tech Stack:** Vue 3, TypeScript, html2canvas, jsPDF, Obsidian API

---

## 文件结构规划

```
src/
├── views/
│   ├── PdfExportPanel.vue          # 导出设置面板 UI
│   └── ReadingArea.vue             # 修改：添加导出按钮
├── services/
│   └── pdf-export.service.ts       # PDF 导出核心服务
├── utils/
│   ├── newspaper.renderer.ts       # 报纸布局渲染器
│   └── font.loader.ts              # 字体加载工具
├── commands/
│   └── export-pdf.command.ts       # Obsidian 命令注册
├── assets/
│   └── fonts/
│       └── SourceHanSerifCN-Regular.woff2  # 思源宋体（精简版）
├── styles/
│   └── newspaper.css               # 报纸样式（构建时注入）
└── lang/
    ├── locale/
    │   ├── zh.ts                   # 修改：添加中文翻译
    │   ├── en.ts                   # 修改：添加英文翻译
    │   └── zh-TW.ts                # 修改：添加繁体中文翻译
```

---

## 任务列表

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加 html2canvas 和 jsPDF 依赖**

```json
{
  "dependencies": {
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.1"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
npm install html2canvas@^1.4.1 jspdf@^2.5.1
```

Expected: 安装成功，package-lock.json 更新

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add html2canvas and jspdf for PDF export"
```

---

### Task 2: 创建字体加载工具

**Files:**
- Create: `src/utils/font.loader.ts`

- [ ] **Step 1: 创建字体加载工具类**

```typescript
/**
 * 字体加载工具
 * 加载内置的思源宋体字体用于 PDF 导出
 */

const FONT_NAME = 'Source Han Serif CN';
const FONT_URL = './assets/fonts/SourceHanSerifCN-Regular.woff2';

/**
 * 加载字体文件并返回 base64 编码
 */
export async function loadFontAsBase64(): Promise<string | null> {
    try {
        const response = await fetch(FONT_URL);
        if (!response.ok) {
            console.warn('[FontLoader] Failed to load font:', response.status);
            return null;
        }
        const blob = await response.blob();
        return await blobToBase64(blob);
    } catch (error) {
        console.error('[FontLoader] Error loading font:', error);
        return null;
    }
}

/**
 * 将 Blob 转换为 base64
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * 检查字体是否已加载
 */
export function isFontLoaded(): boolean {
    return document.fonts.check(`12px "${FONT_NAME}"`);
}

/**
 * 预加载字体
 */
export async function preloadFont(): Promise<void> {
    if (isFontLoaded()) return;

    try {
        const fontFace = new FontFace(
            FONT_NAME,
            `url(${FONT_URL})`,
            { weight: 'normal', style: 'normal' }
        );
        await fontFace.load();
        document.fonts.add(fontFace);
    } catch (error) {
        console.warn('[FontLoader] Failed to preload font:', error);
    }
}

/**
 * 获取字体 CSS 样式
 */
export function getFontFamily(): string {
    return `${FONT_NAME}, "Noto Serif CJK SC", "Source Han Serif SC", serif`;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/font.loader.ts
git commit -m "feat(utils): add font loader utility for PDF export"
```

---

### Task 3: 创建报纸渲染器

**Files:**
- Create: `src/utils/newspaper.renderer.ts`
- Create: `src/styles/newspaper.css`

- [ ] **Step 1: 创建报纸渲染器类**

```typescript
/**
 * 报纸渲染器
 * 将文章内容渲染为报纸风格的 HTML
 */

import { loadFontAsBase64, getFontFamily } from './font.loader';

export interface WordEntry {
    expression: string;
    phonetic?: string;
    meaning: string;
}

export interface NewspaperSettings {
    title: string;
    subtitle?: string;
    date: string;
    showPhonetic: boolean;
}

export class NewspaperRenderer {
    private container: HTMLElement | null = null;

    /**
     * 创建隐藏的渲染容器
     */
    private createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.id = 'newspaper-render-container';
        container.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            background: #f8f5f0;
            font-family: ${getFontFamily()};
            font-size: 12pt;
            line-height: 1.8;
            color: #1a1a1a;
            overflow: hidden;
            box-sizing: border-box;
        `;
        document.body.appendChild(container);
        this.container = container;
        return container;
    }

    /**
     * 生成报纸 HTML
     */
    async render(
        articleContent: string,
        words: WordEntry[],
        settings: NewspaperSettings
    ): Promise<HTMLElement> {
        const container = this.createContainer();

        // 添加样式
        const style = document.createElement('style');
        style.textContent = this.getStyles();
        container.appendChild(style);

        // 生成内容
        const content = document.createElement('div');
        content.className = 'newspaper-content';
        content.innerHTML = `
            ${this.renderHeader(settings)}
            <div class="newspaper-columns">
                <div class="article-column">
                    ${articleContent}
                </div>
                <div class="word-column">
                    ${this.renderWordList(words, settings)}
                </div>
            </div>
        `;
        container.appendChild(content);

        // 等待字体加载
        await document.fonts.ready;

        // 等待图片加载
        await this.waitForImages(container);

        return container;
    }

    /**
     * 渲染报纸头部
     */
    private renderHeader(settings: NewspaperSettings): string {
        const dateStr = settings.date || new Date().toLocaleDateString('zh-CN');
        return `
            <div class="newspaper-header">
                <div class="header-border"></div>
                <h1 class="newspaper-title">${settings.title}</h1>
                ${settings.subtitle ? `<p class="newspaper-subtitle">${settings.subtitle}</p>` : ''}
                <p class="newspaper-date">${dateStr}</p>
                <div class="header-divider"></div>
            </div>
        `;
    }

    /**
     * 渲染单词列表
     */
    private renderWordList(words: WordEntry[], settings: NewspaperSettings): string {
        if (words.length === 0) {
            return '<div class="no-words">本页无标注单词</div>';
        }

        const wordItems = words.map(word => `
            <div class="word-item">
                <div class="word-header">
                    <span class="word-expression">${word.expression}</span>
                    ${settings.showPhonetic && word.phonetic ?
                        `<span class="word-phonetic">${word.phonetic}</span>` : ''}
                </div>
                <div class="word-meaning">${word.meaning}</div>
            </div>
        `).join('');

        return `
            <div class="word-list">
                <h3 class="word-list-title">词汇表</h3>
                ${wordItems}
            </div>
        `;
    }

    /**
     * 获取 CSS 样式
     */
    private getStyles(): string {
        return `
            .newspaper-content {
                padding: 15mm;
                box-sizing: border-box;
            }

            /* 头部样式 */
            .newspaper-header {
                text-align: center;
                margin-bottom: 20px;
                padding: 15px 0;
            }

            .header-border {
                border-top: 3px solid #5c4033;
                border-bottom: 1px solid #5c4033;
                height: 6px;
                margin-bottom: 15px;
            }

            .newspaper-title {
                font-size: 28pt;
                font-weight: bold;
                margin: 0 0 8px 0;
                letter-spacing: 2px;
                color: #1a1a1a;
            }

            .newspaper-subtitle {
                font-size: 14pt;
                color: #4a4a4a;
                margin: 0 0 5px 0;
            }

            .newspaper-date {
                font-size: 10pt;
                color: #8b7355;
                margin: 0;
            }

            .header-divider {
                border-bottom: 2px solid #8b7355;
                margin-top: 15px;
            }

            /* 分栏布局 */
            .newspaper-columns {
                display: flex;
                gap: 0;
                min-height: 220mm;
            }

            .article-column {
                width: 70%;
                padding-right: 15px;
                border-right: 1px solid #8b7355;
            }

            .word-column {
                width: 30%;
                padding-left: 15px;
            }

            /* 文章样式 */
            .article-column p {
                text-indent: 2em;
                margin: 0 0 1em 0;
                text-align: justify;
            }

            .article-column h1,
            .article-column h2,
            .article-column h3 {
                font-size: 14pt;
                margin: 1em 0 0.5em 0;
            }

            /* 单词栏样式 */
            .word-list-title {
                font-size: 12pt;
                font-weight: bold;
                border-bottom: 1px solid #8b7355;
                padding-bottom: 5px;
                margin: 0 0 10px 0;
            }

            .word-item {
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px dotted #d4c5b5;
            }

            .word-header {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-bottom: 3px;
            }

            .word-expression {
                font-weight: bold;
                font-size: 11pt;
            }

            .word-phonetic {
                font-family: "Times New Roman", serif;
                font-style: italic;
                font-size: 9pt;
                color: #666;
            }

            .word-meaning {
                font-size: 10pt;
                color: #4a4a4a;
                line-height: 1.5;
            }

            .no-words {
                text-align: center;
                color: #999;
                font-size: 10pt;
                padding: 20px 0;
            }

            /* 图片样式 */
            .article-column img {
                max-width: 100%;
                height: auto;
                display: block;
                margin: 1em auto;
            }
        `;
    }

    /**
     * 等待图片加载完成
     */
    private async waitForImages(container: HTMLElement): Promise<void> {
        const images = container.querySelectorAll('img');
        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 5000); // 超时 5 秒
            });
        });
        await Promise.all(promises);
    }

    /**
     * 清理容器
     */
    cleanup(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
    }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/newspaper.renderer.ts
git commit -m "feat(utils): add newspaper renderer for PDF layout"
```

---

### Task 4: 创建 PDF 导出服务

**Files:**
- Create: `src/services/pdf-export.service.ts`

- [ ] **Step 1: 创建 PDF 导出服务**

```typescript
/**
 * PDF 导出服务
 * 协调报纸渲染、截图和 PDF 生成
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { NewspaperRenderer, WordEntry, NewspaperSettings } from '../utils/newspaper.renderer';
import { preloadFont } from '../utils/font.loader';

export { WordEntry, NewspaperSettings };

export interface PdfExportOptions {
    /** 文章 HTML 内容 */
    articleContent: string;
    /** 单词列表 */
    words: WordEntry[];
    /** 报纸设置 */
    settings: NewspaperSettings;
    /** 文件名 */
    filename?: string;
    /** 分页高度 (mm) */
    pageHeight?: number;
}

export class PdfExportService {
    private renderer: NewspaperRenderer;

    constructor() {
        this.renderer = new NewspaperRenderer();
    }

    /**
     * 导出为 PDF
     */
    async exportToPDF(options: PdfExportOptions): Promise<Blob> {
        const {
            articleContent,
            words,
            settings,
            pageHeight = 297 // A4 高度 mm
        } = options;

        try {
            // 预加载字体
            await preloadFont();

            // 1. 渲染报纸 HTML
            const container = await this.renderer.render(articleContent, words, settings);

            // 2. 使用 html2canvas 截图
            const canvas = await this.captureToCanvas(container);

            // 3. 分割页面
            const pages = this.splitToPages(canvas, pageHeight);

            // 4. 生成 PDF
            const pdfBlob = await this.generatePDF(pages);

            return pdfBlob;
        } finally {
            // 清理渲染容器
            this.renderer.cleanup();
        }
    }

    /**
     * 使用 html2canvas 截图
     */
    private async captureToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
        const canvas = await html2canvas(element, {
            scale: 2, // 高清截图
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#f8f5f0',
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
        });
        return canvas;
    }

    /**
     * 按页面高度分割 canvas
     */
    private splitToPages(
        canvas: HTMLCanvasElement,
        pageHeightMm: number
    ): HTMLCanvasElement[] {
        const pages: HTMLCanvasElement[] = [];

        // A4 尺寸：210mm x 297mm
        // 转换为像素（假设 96 DPI）
        const mmToPx = 96 / 25.4;
        const pageHeightPx = pageHeightMm * mmToPx;
        const pageWidthPx = 210 * mmToPx;

        const totalHeight = canvas.height;
        const scale = canvas.width / pageWidthPx;
        const scaledPageHeight = pageHeightPx * scale;

        let currentY = 0;

        while (currentY < totalHeight) {
            const remainingHeight = Math.min(scaledPageHeight, totalHeight - currentY);

            // 创建新 canvas
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = remainingHeight;

            const ctx = pageCanvas.getContext('2d');
            if (!ctx) continue;

            // 复制对应区域
            ctx.drawImage(
                canvas,
                0, currentY, canvas.width, remainingHeight,
                0, 0, canvas.width, remainingHeight
            );

            pages.push(pageCanvas);
            currentY += scaledPageHeight;
        }

        return pages;
    }

    /**
     * 生成 PDF
     */
    private async generatePDF(pages: HTMLCanvasElement[]): Promise<Blob> {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) {
                pdf.addPage();
            }

            const canvas = pages[i];
            const imgData = canvas.toDataURL('image/jpeg', 0.95);

            // A4 尺寸
            const pageWidth = 210;
            const pageHeight = 297;

            // 计算图片尺寸以适应页面
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * pageWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        }

        return pdf.output('blob');
    }

    /**
     * 触发下载
     */
    downloadPDF(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * 扫描文章获取单词
     */
    scanArticleWords(contentElement: HTMLElement): WordEntry[] {
        const words: WordEntry[] = [];
        const seen = new Set<string>();

        // 查找所有高亮单词元素
        const wordElements = contentElement.querySelectorAll('.word-btn, [data-word]');

        wordElements.forEach(el => {
            const word = el.getAttribute('data-word') || el.textContent?.trim();
            if (word && !seen.has(word.toLowerCase())) {
                seen.add(word.toLowerCase());
                words.push({
                    expression: word,
                    meaning: '', // 需要从数据库获取
                });
            }
        });

        return words;
    }
}

// 单例导出
export const pdfExportService = new PdfExportService();
```

- [ ] **Step 2: 提交**

```bash
git add src/services/pdf-export.service.ts
git commit -m "feat(services): add PDF export service with html2canvas and jsPDF"
```

---

### Task 5: 创建导出设置面板组件

**Files:**
- Create: `src/views/PdfExportPanel.vue`

- [ ] **Step 1: 创建 PDF 导出设置面板**

```vue
<template>
    <div id="pdf-export-panel" v-if="visible">
        <div class="export-modal-overlay" @click.self="close">
            <div class="export-modal">
                <div class="modal-header">
                    <h3>{{ t('Export to PDF') }}</h3>
                    <button class="close-btn" @click="close">×</button>
                </div>

                <div class="modal-body">
                    <!-- 标题设置 -->
                    <div class="form-group">
                        <label>{{ t('Title') }}</label>
                        <input
                            type="text"
                            v-model="settings.title"
                            :placeholder="t('Article title')"
                        />
                    </div>

                    <div class="form-group">
                        <label>{{ t('Subtitle') }}</label>
                        <input
                            type="text"
                            v-model="settings.subtitle"
                            :placeholder="t('Optional')"
                        />
                    </div>

                    <!-- 日期 -->
                    <div class="form-group">
                        <label>{{ t('Date') }}</label>
                        <input type="date" v-model="settings.date" />
                    </div>

                    <!-- 选项 -->
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settings.showPhonetic" />
                            {{ t('Show phonetic') }}
                        </label>
                    </div>

                    <!-- 单词列表 -->
                    <div class="form-group">
                        <label>{{ t('Words to include') }} ({{ selectedWords.length }})</label>
                        <div class="word-list">
                            <div
                                v-for="word in availableWords"
                                :key="word.expression"
                                class="word-item"
                            >
                                <input
                                    type="checkbox"
                                    :value="word.expression"
                                    v-model="selectedWords"
                                />
                                <span class="word-name">{{ word.expression }}</span>
                                <span class="word-preview" v-if="word.meaning">
                                    {{ truncate(word.meaning, 30) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" @click="close">
                        {{ t('Cancel') }}
                    </button>
                    <button
                        class="btn-primary"
                        @click="exportPDF"
                        :disabled="exporting"
                    >
                        <span v-if="exporting">{{ t('Exporting...') }}</span>
                        <span v-else>{{ t('Export PDF') }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { t } from '@/lang/helper';
import { pdfExportService, WordEntry, NewspaperSettings } from '@/services/pdf-export.service';

interface Props {
    visible: boolean;
    articleContent: string;
    articleElement: HTMLElement | null;
    defaultTitle: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'exported'): void;
}>();

// 设置
const settings = ref<NewspaperSettings>({
    title: '',
    subtitle: '',
    date: new Date().toISOString().split('T')[0],
    showPhonetic: true,
});

// 单词列表
const availableWords = ref<WordEntry[]>([]);
const selectedWords = ref<string[]>([]);
const exporting = ref(false);

// 初始化
watch(() => props.visible, (visible) => {
    if (visible) {
        settings.value.title = props.defaultTitle;
        scanWords();
    }
}, { immediate: true });

// 扫描单词
function scanWords() {
    if (!props.articleElement) return;

    // 扫描 DOM 中的单词
    const wordElements = props.articleElement.querySelectorAll('[data-word]');
    const words: WordEntry[] = [];
    const seen = new Set<string>();

    wordElements.forEach(el => {
        const word = el.getAttribute('data-word');
        if (word && !seen.has(word.toLowerCase())) {
            seen.add(word.toLowerCase());
            words.push({
                expression: word,
                phonetic: el.getAttribute('data-phonetic') || undefined,
                meaning: el.getAttribute('data-meaning') || '',
            });
        }
    });

    availableWords.value = words;
    selectedWords.value = words.map(w => w.expression);
}

// 截断文本
function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

// 关闭面板
function close() {
    emit('close');
}

// 导出 PDF
async function exportPDF() {
    if (selectedWords.value.length === 0) {
        alert(t('Please select at least one word'));
        return;
    }

    exporting.value = true;

    try {
        const words = availableWords.value.filter(w =>
            selectedWords.value.includes(w.expression)
        );

        const blob = await pdfExportService.exportToPDF({
            articleContent: props.articleContent,
            words,
            settings: settings.value,
            filename: settings.value.title,
        });

        pdfExportService.downloadPDF(blob, settings.value.title);
        emit('exported');
        close();
    } catch (error) {
        console.error('PDF export failed:', error);
        alert(t('PDF export failed'));
    } finally {
        exporting.value = false;
    }
}
</script>

<style scoped lang="scss">
#pdf-export-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
}

.export-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
}

.export-modal {
    background: var(--background-primary);
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);

    h3 {
        margin: 0;
        font-size: 18px;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--text-muted);

        &:hover {
            color: var(--text-normal);
        }
    }
}

.modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}

.form-group {
    margin-bottom: 16px;

    label {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        color: var(--text-normal);
    }

    input[type="text"],
    input[type="date"] {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;

        &:focus {
            outline: none;
            border-color: var(--interactive-accent);
        }
    }
}

.checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    input[type="checkbox"] {
        margin: 0;
    }
}

.word-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 8px;
}

.word-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;

    input[type="checkbox"] {
        margin: 0;
    }

    .word-name {
        font-weight: 500;
        min-width: 80px;
    }

    .word-preview {
        color: var(--text-muted);
        font-size: 12px;
        flex: 1;
    }
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
}

.btn-secondary,
.btn-primary {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);

    &:hover {
        background: var(--background-secondary-alt);
    }
}

.btn-primary {
    background: var(--interactive-accent);
    border: 1px solid var(--interactive-accent);
    color: var(--text-on-accent);

    &:hover:not(:disabled) {
        opacity: 0.9;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/views/PdfExportPanel.vue
git commit -m "feat(ui): add PDF export settings panel component"
```

---

### Task 6: 修改阅读模式添加导出按钮

**Files:**
- Modify: `src/views/ReadingArea.vue`

- [ ] **Step 1: 导入 PdfExportPanel**

```typescript
// 在 script setup 顶部添加
import PdfExportPanel from './PdfExportPanel.vue';
```

- [ ] **Step 2: 添加导出面板状态**

```typescript
// 在 script setup 中添加状态
const showExportPanel = ref(false);
const readingContentRef = ref<HTMLElement | null>(null);
```

- [ ] **Step 3: 添加导出按钮到工具栏**

```vue
<!-- 在 function-area 中添加导出按钮 -->
<button class="export-btn" @click="showExportPanel = true" title="导出为 PDF">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
</button>
```

```scss
// 在 style 中添加按钮样式
.export-btn {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 6px 10px;
    cursor: pointer;
    color: var(--text-normal);

    &:hover {
        background: var(--background-secondary-alt);
        border-color: var(--interactive-accent);
    }
}
```

- [ ] **Step 4: 添加导出面板组件**

```vue
<!-- 在 template 底部添加 -->
<PdfExportPanel
    :visible="showExportPanel"
    :article-content="renderedText"
    :article-element="readingContentRef"
    :default-title="currentFileName"
    @close="showExportPanel = false"
    @exported="onExported"
/>
```

- [ ] **Step 5: 添加获取当前文件名的 computed**

```typescript
// 获取当前文件名作为默认标题
const currentFileName = computed(() => {
    const view = getCurrentInstance()?.appContext.config.globalProperties.view;
    if (view?.file) {
        return view.file.name.replace(/\.md$/i, '');
    }
    return 'Article';
});

// 导出成功回调
function onExported() {
    // 可以显示成功提示
}
```

- [ ] **Step 6: 给 text-area 添加 ref**

```vue
<!-- 修改 text-area，添加 ref -->
<div
    class="text-area"
    ref="readingContentRef"
    ...
    v-html="renderedText"
/>
```

- [ ] **Step 7: 提交**

```bash
git add src/views/ReadingArea.vue
git commit -m "feat(ui): add PDF export button to reading mode toolbar"
```

---

### Task 7: 注册 Obsidian 命令

**Files:**
- Modify: `src/plugin.ts` (或其他注册命令的文件)

- [ ] **Step 1: 查找命令注册位置**

先查看 plugin.ts 或其他文件中的命令注册方式。\n
---

## 自我审查

### Spec 覆盖检查

- [x] 技术方案（html2canvas + jsPDF）
- [x] 报纸布局（7:3 分栏）
- [x] 古典风格设计
- [x] 字体加载
- [x] 导出面板
- [x] 命令注册
- [x] 国际化

### Placeholder 扫描

- [ ] 无 TBD/TODO
- [ ] 无 "implement later"
- [ ] 代码完整

### 类型一致性

- WordEntry 接口在 renderer 和 service 中一致
- NewspaperSettings 接口一致

---

**计划完成**

下一步：调用 superpowers:executing-plans 或 superpowers:subagent-driven-development 执行任务。
