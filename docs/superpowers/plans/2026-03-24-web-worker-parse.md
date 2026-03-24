# Web Worker 文本解析优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将文本解析操作移至 Web Worker 后台线程执行，避免长文章解析时阻塞 UI，提升阅读模式流畅度。

**Architecture:**
- 创建 `ParseWorker` 类管理 Worker 生命周期和通信
- Worker 中运行简化版解析逻辑（使用正则分词替代 unified/retext，避免复杂依赖）
- 主线程通过消息传递与 Worker 通信，保持异步接口
- 实现 fallback 机制：Worker 失败时自动回退到主线程解析

**Tech Stack:** TypeScript, Web Worker API, esbuild

---

## 文件结构概览

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/workers/parse.worker.ts` | Web Worker 入口，执行文本解析 | 创建 |
| `src/utils/parseWorker.ts` | Worker 管理类，处理通信和 fallback | 创建 |
| `src/views/parser.ts` | 集成 Worker 支持，修改 parse 方法 | 修改 |
| `esbuild.config.mjs` | 配置 Worker 构建 | 修改 |

---

## 背景说明

### 当前问题

`TextParser.parse()` 方法使用 unified/retext 进行自然语言解析，长文章（>5000词）解析时会阻塞 UI 主线程，导致：
1. 翻页时卡顿
2. 滑动条操作不流畅
3. 影响整体用户体验

### 解决方案

1. **Web Worker 后台解析**：将耗时的文本解析移至 Worker 线程
2. **简化分词逻辑**：Worker 中使用基于正则的轻量级分词，避免加载完整的 unified/retext 依赖
3. **保持缓存机制**：Worker 解析结果仍通过主线程的缓存系统
4. **Fallback 机制**：Worker 创建失败时自动回退到主线程解析

### 简化分词策略

由于 unified/retext 依赖复杂（需要 nlcst、unist 等库），Worker 中使用简化策略：

```typescript
// Worker 中的简化分词
function simpleTokenize(text: string): Token[] {
    // 按段落分割
    // 按句子分割（基于 .!? 后跟空格或大写）
    // 按单词分割（基于空格和标点）
    // 标记单词状态（根据传入的单词列表）
}
```

---

## Phase 1: 创建 Web Worker 文件

### Task 1.1: 创建 Parse Worker

**Files:**
- Create: `src/workers/parse.worker.ts`

**背景：** Worker 需要在独立线程运行，使用简化版解析逻辑。

- [ ] **Step 1: 创建 Worker 文件结构**

创建 `src/workers/parse.worker.ts`：

```typescript
/**
 * 文本解析 Web Worker
 * 在后台线程执行文本解析，避免阻塞 UI
 */

import { Phrase, Word } from "@/db/interface";

// Worker 全局类型
declare const self: DedicatedWorkerGlobalScope;

// 消息类型定义
interface ParseRequestMessage {
    type: "PARSE_REQUEST";
    id: number;
    text: string;
    words: Word[];
    phrases: Phrase[];
}

interface ParseResponseMessage {
    type: "PARSE_RESPONSE";
    id: number;
    html: string;
    error?: string;
}

// 简单 token 类型
interface Token {
    type: "word" | "punctuation" | "whitespace" | "other";
    text: string;
    status?: string;
}

// Worker 消息处理
self.onmessage = function (e: MessageEvent<ParseRequestMessage>) {
    const { id, text, words, phrases } = e.data;

    try {
        const html = parseText(text, words, phrases);
        const response: ParseResponseMessage = {
            type: "PARSE_RESPONSE",
            id,
            html
        };
        self.postMessage(response);
    } catch (err) {
        const response: ParseResponseMessage = {
            type: "PARSE_RESPONSE",
            id,
            html: "",
            error: err instanceof Error ? err.message : String(err)
        };
        self.postMessage(response);
    }
};

/**
 * 简化版文本解析
 * 使用正则分词而非 unified/retext
 */
function parseText(text: string, words: Word[], phrases: Phrase[]): string {
    // 创建单词状态查找表
    const wordStatusMap = new Map<string, number>();
    for (const word of words) {
        wordStatusMap.set(word.text.toLowerCase(), word.status);
    }

    // 创建短语查找表
    const phraseSet = new Set(phrases.map(p => p.text.toLowerCase()));

    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    const result: string[] = [];

    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;

        // 检查是否是 Markdown 图片语法
        if (paragraph.match(/^!\[.*?\]\(.*?\)$/)) {
            result.push(processMarkdownImage(paragraph));
            continue;
        }

        // 检查是否是标题
        const headerMatch = paragraph.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const content = tokenizeAndWrap(headerMatch[2], wordStatusMap, phraseSet);
            result.push(`<h${level}><span class="stns">${content}</span></h${level}>`);
            continue;
        }

        // 普通段落
        const content = tokenizeAndWrap(paragraph, wordStatusMap, phraseSet);
        result.push(`<p>${content}</p>`);
    }

    return `<div class="article">${result.join("")}</div>`;
}

/**
 * 分词并包裹 HTML
 */
function tokenizeAndWrap(
    text: string,
    wordStatusMap: Map<string, number>,
    phraseSet: Set<string>
): string {
    const tokens = tokenize(text);
    const result: string[] = [];

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];

        // 尝试匹配短语
        let phraseMatch: string | null = null;
        let phraseLength = 0;

        // 从当前位置开始，尝试匹配最长的短语
        for (let len = Math.min(10, tokens.length - i); len > 0; len--) {
            const candidate = tokens.slice(i, i + len)
                .filter(t => t.type === "word" || t.type === "whitespace")
                .map(t => t.text.toLowerCase())
                .join("");

            if (phraseSet.has(candidate)) {
                phraseMatch = candidate;
                phraseLength = len;
                break;
            }
        }

        if (phraseMatch) {
            // 找到短语，包裹 phrase span
            const phraseTokens = tokens.slice(i, i + phraseLength);
            const phraseHtml = phraseTokens.map(t => wrapToken(t, wordStatusMap)).join("");
            // 获取短语状态（默认为 learning）
            result.push(`<span class="phrase learning">${phraseHtml}</span>`);
            i += phraseLength;
        } else {
            // 普通 token
            result.push(wrapToken(token, wordStatusMap));
            i++;
        }
    }

    return result.join("");
}

/**
 * 简单分词
 */
function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    const regex = /([a-zA-Z]+)|(\s+)|([0-9\u4e00-\u9fa5]+)|(.)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            tokens.push({ type: "word", text: match[1] });
        } else if (match[2]) {
            tokens.push({ type: "whitespace", text: match[2] });
        } else if (match[3]) {
            tokens.push({ type: "other", text: match[3] });
        } else {
            tokens.push({ type: "punctuation", text: match[4] });
        }
    }

    return tokens;
}

/**
 * 包裹单个 token
 */
function wrapToken(token: Token, wordStatusMap: Map<string, number>): string {
    if (token.type === "whitespace") {
        return token.text;
    }

    if (token.type === "other") {
        return `<span class="other">${escapeHtml(token.text)}</span>`;
    }

    if (token.type === "punctuation") {
        return escapeHtml(token.text);
    }

    // word 类型
    const lowerText = token.text.toLowerCase();
    const status = wordStatusMap.has(lowerText)
        ? STATUS_MAP[wordStatusMap.get(lowerText)!]
        : "new";

    return `<span class="word ${status}">${escapeHtml(token.text)}</span>`;
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 处理 Markdown 图片
 */
function processMarkdownImage(paragraph: string): string {
    const match = paragraph.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (!match) return `<p>${paragraph}</p>`;

    const alt = match[1];
    const src = match[2];
    return `<div style="text-align:center"><div style="display:inline-block"><img alt="${alt}" src="${src}"></div></div>`;
}

// 单词状态映射
const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];

export {};
```

- [ ] **Step 2: 验证 TypeScript 语法**

运行：
```bash
npx tsc src/workers/parse.worker.ts --noEmit --skipLibCheck --module esnext --moduleResolution node --target es2017
```

预期：无错误（或只有导入路径相关的错误，这些在构建时会解决）

- [ ] **Step 3: Commit Worker 文件创建**

```bash
git add src/workers/parse.worker.ts
git commit -m "feat: 创建文本解析 Web Worker

- 添加简化版文本解析逻辑
- 使用正则分词替代 unified/retext
- 支持短语匹配和单词状态标记"
```

---

## Phase 2: 创建 Worker 管理类

### Task 2.1: 创建 ParseWorker 管理类

**Files:**
- Create: `src/utils/parseWorker.ts`

**背景：** 封装 Worker 创建、通信、错误处理和 fallback 逻辑。

- [ ] **Step 1: 创建 Worker 管理类**

创建 `src/utils/parseWorker.ts`：

```typescript
/**
 * Parse Worker 管理类
 * 处理 Worker 创建、通信、错误处理和 fallback
 */

import { Phrase, Word } from "@/db/interface";

// Worker 消息类型
interface ParseRequestMessage {
    type: "PARSE_REQUEST";
    id: number;
    text: string;
    words: Word[];
    phrases: Phrase[];
}

interface ParseResponseMessage {
    type: "PARSE_RESPONSE";
    id: number;
    html: string;
    error?: string;
}

// 待处理请求
interface PendingRequest {
    resolve: (html: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export class ParseWorkerManager {
    private worker: Worker | null = null;
    private requestId = 0;
    private pendingRequests = new Map<number, PendingRequest>();
    private fallbackMode = false;
    private workerScript: string;

    constructor() {
        // 读取 Worker 代码作为字符串（由构建工具注入）
        this.workerScript = this.getWorkerScript();
    }

    /**
     * 获取 Worker 脚本代码
     * 实际代码由构建时注入
     */
    private getWorkerScript(): string {
        // 在构建时会被替换为实际的 Worker 代码
        return "";
    }

    /**
     * 初始化 Worker
     */
    private initWorker(): boolean {
        if (this.worker) return true;
        if (this.fallbackMode) return false;

        try {
            // 使用 Blob URL 创建 Worker
            const blob = new Blob([this.workerScript], { type: "application/javascript" });
            const workerUrl = URL.createObjectURL(blob);
            this.worker = new Worker(workerUrl);

            this.worker.onmessage = this.handleMessage.bind(this);
            this.worker.onerror = this.handleError.bind(this);

            return true;
        } catch (err) {
            console.warn("Failed to create Web Worker:", err);
            this.fallbackMode = true;
            return false;
        }
    }

    /**
     * 处理 Worker 消息
     */
    private handleMessage(e: MessageEvent<ParseResponseMessage>) {
        const { id, html, error } = e.data;
        const request = this.pendingRequests.get(id);
        if (!request) return;

        this.pendingRequests.delete(id);
        clearTimeout(request.timer);

        if (error) {
            request.reject(new Error(error));
        } else {
            request.resolve(html);
        }
    }

    /**
     * 处理 Worker 错误
     */
    private handleError(err: ErrorEvent) {
        console.error("Worker error:", err);
        // 所有待处理请求都 reject
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timer);
            request.reject(new Error("Worker error: " + err.message));
        }
        this.pendingRequests.clear();

        // 切换到 fallback 模式
        this.terminate();
        this.fallbackMode = true;
    }

    /**
     * 发送解析请求
     */
    async parse(text: string, words: Word[], phrases: Phrase[]): Promise<string> {
        // 尝试使用 Worker
        if (this.initWorker()) {
            try {
                return await this.parseWithWorker(text, words, phrases);
            } catch (err) {
                console.warn("Worker parse failed, falling back to main thread:", err);
                // fallback 到主线程解析
            }
        }

        // 主线程解析 fallback
        return this.parseInMainThread(text, words, phrases);
    }

    /**
     * 使用 Worker 解析
     */
    private async parseWithWorker(
        text: string,
        words: Word[],
        phrases: Phrase[]
    ): Promise<string> {
        const id = ++this.requestId;

        return new Promise((resolve, reject) => {
            // 设置超时
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error("Worker parse timeout"));
            }, 10000); // 10秒超时

            this.pendingRequests.set(id, { resolve, reject, timer });

            // 发送请求到 Worker
            const message: ParseRequestMessage = {
                type: "PARSE_REQUEST",
                id,
                text,
                words,
                phrases
            };
            this.worker!.postMessage(message);
        });
    }

    /**
     * 主线程解析（fallback）
     * 简化版实现
     */
    private parseInMainThread(
        text: string,
        words: Word[],
        phrases: Phrase[]
    ): string {
        // 创建查找表
        const wordStatusMap = new Map<string, number>();
        for (const word of words) {
            wordStatusMap.set(word.text.toLowerCase(), word.status);
        }

        // 使用简化逻辑解析
        const paragraphs = text.split(/\n\n+/);
        const result: string[] = [];

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;

            // 简单处理：直接分词并包裹
            const tokens = paragraph.split(/(\s+)/);
            const wrapped = tokens.map(token => {
                if (/^\s+$/.test(token)) return token;
                const lower = token.toLowerCase();
                if (wordStatusMap.has(lower)) {
                    const status = ["ignore", "learning", "familiar", "known", "learned"][wordStatusMap.get(lower)!];
                    return `<span class="word ${status}">${token}</span>`;
                }
                if (/[0-9\u4e00-\u9fa5]/.test(token)) {
                    return `<span class="other">${token}</span>`;
                }
                return `<span class="word new">${token}</span>`;
            });

            result.push(`<p>${wrapped.join("")}</p>`);
        }

        return `<div class="article">${result.join("")}</div>`;
    }

    /**
     * 销毁 Worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        // 清理待处理请求
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timer);
            request.reject(new Error("Worker terminated"));
        }
        this.pendingRequests.clear();
    }
}

// 单例实例
let workerManager: ParseWorkerManager | null = null;

/**
 * 获取 Worker 管理器实例
 */
export function getParseWorker(): ParseWorkerManager {
    if (!workerManager) {
        workerManager = new ParseWorkerManager();
    }
    return workerManager;
}

/**
 * 释放 Worker 资源
 */
export function disposeParseWorker() {
    if (workerManager) {
        workerManager.terminate();
        workerManager = null;
    }
}
```

- [ ] **Step 2: Commit Worker 管理类**

```bash
git add src/utils/parseWorker.ts
git commit -m "feat: 添加 ParseWorker 管理类

- 封装 Worker 创建和通信逻辑
- 实现 fallback 机制
- 添加超时处理"
```

---

## Phase 3: 修改 esbuild 配置

### Task 3.1: 配置 Worker 构建

**Files:**
- Modify: `esbuild.config.mjs`

**背景：** 需要将 Worker 代码内联到主包中，使用 Blob URL 创建 Worker。

- [ ] **Step 1: 读取当前 esbuild 配置**

读取 `esbuild.config.mjs` 了解当前配置。

- [ ] **Step 2: 修改配置支持 Worker 内联**

修改 `esbuild.config.mjs`，在构建时将 Worker 代码作为字符串注入：

```javascript
// 在 esbuild.config.mjs 中添加
const fs = require('fs');
const path = require('path');

// 读取 Worker 文件并转换为字符串
const workerPath = path.join(__dirname, 'src/workers/parse.worker.ts');
const workerCode = fs.readFileSync(workerPath, 'utf-8');

// 在 esbuild 配置中添加 define
const define = {
    'process.env.WORKER_SCRIPT': JSON.stringify(workerCode)
};

// 添加到 esbuild 配置
await esbuild.build({
    // ... 其他配置
    define,
    // ...
});
```

**注意：** 实际实现可能需要更复杂的处理，因为 Worker 代码需要单独编译。

---

## Phase 4: 修改 Parser 集成 Worker

### Task 4.1: 修改 TextParser 使用 Worker

**Files:**
- Modify: `src/views/parser.ts`

- [ ] **Step 1: 导入 Worker 管理类**

在 `src/views/parser.ts` 中添加：

```typescript
import { getParseWorker, disposeParseWorker } from "@/utils/parseWorker";
```

- [ ] **Step 2: 修改 parse 方法使用 Worker**

修改 `parse` 方法：

```typescript
async parse(data: string): Promise<string> {
    // 检查缓存
    const cached = getCachedParseResult(data);
    if (cached) {
        return cached;
    }

    // 获取单词和短语数据
    this.phrases = (
        await this.plugin.db.getStoredWords({
            article: data.toLowerCase(),
            words: [],
        })
    ).phrases;

    const wordSet: Set<string> = new Set();
    // ... 提取单词

    let stored = await this.plugin.db.getStoredWords({
        article: "",
        words: [...wordSet],
    });

    // 使用 Worker 解析
    const worker = getParseWorker();
    const html = await worker.parse(data, stored.words, this.phrases);

    // 缓存结果
    cacheParseResult(data, html);

    return html;
}
```

---

## 风险评估与回滚策略

### 风险

1. **Worker 创建失败**：某些环境可能不支持 Web Worker
   - **缓解**：已实现 fallback 到主线程解析

2. **Worker 代码编译问题**：Worker 代码可能需要特殊处理
   - **缓解**：使用简化版解析逻辑，避免复杂依赖

3. **内存泄漏**：Worker 实例未及时释放
   - **缓解**：添加 `terminate` 方法，在插件卸载时调用

### 回滚策略

如果 Worker 实现出现问题：

1. 保留原有的 `TextParser` 完整实现
2. Worker 失败时自动回退到主线程
3. 可通过配置禁用 Worker（如添加 `useWorker: false` 选项）

---

## 测试计划

### 功能测试

1. **Worker 正常工作**
   - 打开长文章（>5000词）
   - 观察翻页是否流畅
   - 验证解析结果正确

2. **Fallback 机制**
   - 模拟 Worker 创建失败
   - 验证自动回退到主线程

3. **缓存兼容性**
   - 验证 Worker 解析结果仍能被缓存
   - 验证缓存命中时不会调用 Worker

### 性能测试

1. **解析时间对比**
   - 记录 Worker 解析 vs 主线程解析时间
   - 长文章应明显提升流畅度

2. **内存占用**
   - 监控 Worker 内存使用
   - 验证无内存泄漏
