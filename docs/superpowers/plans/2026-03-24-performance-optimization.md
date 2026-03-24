# Language Learner 性能优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 AC 自动机缓存、样式滑动条防抖、Web Worker 解析等性能优化，提升插件运行效率。

**Architecture:**
- AC 自动机缓存：在 LocalDb 类中维护缓存实例，短语数据变化时重建
- 防抖：使用标准 debounce 函数包装样式设置更新
- Web Worker：创建独立的解析工作线程，通过消息传递与主线程通信

**Tech Stack:** TypeScript, Vue 3, esbuild, Web Worker API

---

## 文件结构概览

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/db/local_db.ts` | AC 自动机缓存实现 | 修改 |
| `src/utils/helpers.ts` | 添加防抖工具函数 | 修改 |
| `src/views/ReadingArea.vue` | 集成防抖到样式滑动条 | 修改 |
| `src/workers/parse.worker.ts` | Web Worker 解析逻辑 | 创建 |
| `src/views/parser.ts` | 添加 Worker 支持 | 修改 |

---

## Phase 1: AC 自动机缓存

### Task 1.1: 添加 AC 自动机缓存到 LocalDb

**Files:**
- Modify: `src/db/local_db.ts`

**背景：** 当前每次调用 `getStoredWords()` 都会重建 AC 自动机，当短语数量大时（>1000条），构建自动机耗时明显。应该缓存自动机实例，只有短语数据变化时才重建。

- [ ] **Step 1: 添加缓存字段和版本号到 LocalDb 类**

在 `src/db/local_db.ts` 的 `LocalDb` 类中添加：

```typescript
export class LocalDb extends DbProvider {
    idb: WordDB;
    plugin: Plugin;

    // AC 自动机缓存
    private acCache: {
        automaton: Automaton | null;
        phrasesHash: string;  // 短语数据哈希，用于判断是否需要重建
    } = {
        automaton: null,
        phrasesHash: ""
    };

    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.idb = new WordDB(plugin);
    }
```

- [ ] **Step 2: 添加短语哈希计算函数**

在 `LocalDb` 类中添加私有方法：

```typescript
    /**
     * 计算短语列表的简单哈希
     */
    private hashPhrases(phrases: string[]): string {
        // 使用简单的字符串哈希，考虑性能和冲突平衡
        let hash = 0;
        const str = phrases.sort().join("|");
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
```

- [ ] **Step 3: 修改 getStoredWords 使用缓存**

修改 `getStoredWords` 方法：

```typescript
    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        // 获取所有短语及其状态
        let storedPhrases = new Map<string, number>();
        await this.idb.expressions
            .where("t").equals("PHRASE")
            .each(expr => storedPhrases.set(expr.expression, expr.status));

        let storedWords = (await this.idb.expressions
            .where("expression").anyOf(payload.words)
            .toArray()
        ).map(expr => {
            return { text: expr.expression, status: expr.status } as Word;
        });

        // 计算当前短语哈希
        const phraseKeys = [...storedPhrases.keys()];
        const currentHash = this.hashPhrases(phraseKeys);

        // 检查缓存是否有效
        let ac: Automaton;
        if (this.acCache.automaton && this.acCache.phrasesHash === currentHash) {
            // 使用缓存的自动机
            ac = this.acCache.automaton;
        } else {
            // 重建自动机并缓存
            ac = await createAutomaton(phraseKeys);
            this.acCache.automaton = ac;
            this.acCache.phrasesHash = currentHash;
        }

        let searchedPhrases = (await ac.search(payload.article)).map(match => {
            return { text: match[1], status: storedPhrases.get(match[1]), offset: match[0] } as Phrase;
        });

        return { words: storedWords, phrases: searchedPhrases };
    }
```

- [ ] **Step 4: 添加缓存清除方法**

在 `LocalDb` 类中添加：

```typescript
    /**
     * 清除 AC 自动机缓存
     * 在短语数据发生变化时调用
     */
    clearACCache(): void {
        this.acCache.automaton = null;
        this.acCache.phrasesHash = "";
    }
```

- [ ] **Step 5: 在 postExpression 后清除缓存**

在 `postExpression` 方法末尾添加缓存清除：

```typescript
    async postExpression(payload: ExpressionInfo): Promise<number> {
        // ... 原有代码 ...

        if (stored) {
            await this.idb.expressions.update(stored.id, updatedWord);
        } else {
            await this.idb.expressions.add(updatedWord);
        }

        // 如果添加/更新的是短语，清除 AC 缓存
        if (payload.t === "PHRASE") {
            this.clearACCache();
        }

        return 200;
    }
```

- [ ] **Step 6: 验证 TypeScript 编译**

运行：
```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 7: 构建插件**

运行：
```bash
npm run build
```

预期：构建成功，main.js 正常生成

- [ ] **Step 8: 功能测试**

1. 打开 Obsidian，进入阅读模式
2. 打开一篇文章，观察是否正常解析词组
3. 添加一个新的短语，再打开另一篇文章，验证短语高亮是否正常
4. 多次切换文章，观察性能是否有提升

- [ ] **Step 9: Commit**

```bash
git add src/db/local_db.ts
git commit -m "perf: 添加 AC 自动机缓存，避免重复构建自动机

- 缓存 AC 自动机实例和短语数据哈希
- 仅在短语数据变化时重建自动机
- 添加 clearACCache 方法用于缓存清理"
```

---

## Phase 2: 样式滑动条防抖

### Task 2.1: 添加防抖工具函数

**Files:**
- Modify: `src/utils/helpers.ts`

- [ ] **Step 1: 添加 debounce 函数**

在 `src/utils/helpers.ts` 末尾添加：

```typescript
/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (...args: Parameters<T>) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn(...args);
        }, delay);
    };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

运行：
```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/utils/helpers.ts
git commit -m "feat: 添加防抖工具函数 debounce

用于优化频繁触发的事件处理，如样式滑动条"
```

### Task 2.2: 集成防抖到 ReadingArea 样式设置

**Files:**
- Modify: `src/views/ReadingArea.vue`

- [ ] **Step 1: 导入 debounce 函数**

在 `src/views/ReadingArea.vue` 的 script 部分添加导入：

```typescript
import { debounce } from "@/utils/helpers";
```

- [ ] **Step 2: 修改样式更新逻辑**

找到样式设置相关代码（约第 228 行），修改为：

```typescript
// 创建防抖的样式更新函数
const updateStyles = debounce((fs: number, lh: number, ws: number) => {
    store.fontSize = `${fs}px`;
    store.lineHeight = `${lh}`;
    store.wordSpacing = `${ws}em`;
}, 100); // 100ms 防抖延迟

// 监听样式变化
watch([fontSizeNum, lineHeightNum, wordSpacingNum], ([fs, lh, ws]) => {
    updateStyles(fs, lh, ws);
}, { immediate: true });
```

- [ ] **Step 3: 构建插件**

运行：
```bash
npm run build
```

预期：构建成功

- [ ] **Step 4: 功能测试**

1. 打开阅读模式
2. 快速拖动样式滑动条（字号、行距、字距）
3. 观察文本样式是否平滑更新，不会卡顿
4. 停止拖动后样式应正确应用

- [ ] **Step 5: Commit**

```bash
git add src/views/ReadingArea.vue src/utils/helpers.ts
git commit -m "perf: 为样式滑动条添加防抖优化

- 添加 100ms 防抖延迟，避免频繁触发重渲染
- 提升滑动条操作流畅度"
```

---

## Phase 3: Web Worker 解析（可选，复杂度较高）

> **注意：** Web Worker 优化涉及较多改动，建议先完成前两个阶段。如果决定实施，请确保充分测试。

### Task 3.1: 创建解析 Worker 文件

**Files:**
- Create: `src/workers/parse.worker.ts`

- [ ] **Step 1: 创建 Worker 文件基础结构**

创建 `src/workers/parse.worker.ts`：

```typescript
/**
 * 文本解析 Web Worker
 * 在后台线程执行文本解析，避免阻塞 UI
 */

// Worker 全局类型声明
declare const self: DedicatedWorkerGlobalScope;

interface ParseRequest {
    id: number;
    text: string;
    words: Array<{ text: string; status: number }>;
    phrases: Array<{ text: string; status: number; offset: number }>;
}

interface ParseResponse {
    id: number;
    html: string;
    error?: string;
}

// 简化的解析逻辑（无需依赖 unified/retext）
// 实际实现需要移植 parser.ts 的核心逻辑
self.onmessage = function (e: MessageEvent<ParseRequest>) {
    const { id, text, words, phrases } = e.data;

    try {
        // TODO: 实现 Worker 端的解析逻辑
        // 由于 unified/retext 依赖较多，可能需要简化或使用其他方案
        const html = parseInWorker(text, words, phrases);

        const response: ParseResponse = { id, html };
        self.postMessage(response);
    } catch (err) {
        const response: ParseResponse = {
            id,
            html: "",
            error: err instanceof Error ? err.message : String(err)
        };
        self.postMessage(response);
    }
};

function parseInWorker(
    text: string,
    words: Array<{ text: string; status: number }>,
    phrases: Array<{ text: string; status: number; offset: number }>
): string {
    // 简化的解析实现
    // 实际应该使用更高效的算法
    return `<p>${text}</p>`;
}

export {};
```

- [ ] **Step 2: Commit Worker 文件创建**

```bash
git add src/workers/parse.worker.ts
git commit -m "feat: 创建文本解析 Web Worker 基础结构

- 添加 Worker 消息类型定义
- 实现基础的消息处理框架"
```

### Task 3.2: 配置 esbuild 支持 Worker

**Files:**
- Modify: `esbuild.config.mjs`

- [ ] **Step 1: 检查当前 esbuild 配置**

读取 `esbuild.config.mjs`，了解当前配置结构。

- [ ] **Step 2: 添加 Worker 构建配置**

由于 esbuild 原生支持 Worker，需要确保配置正确。可能需要修改入口点或添加额外的构建步骤。

**注意：** 这一步比较复杂，可能需要创建单独的 Worker 构建流程。如果遇到困难，可以考虑：
1. 使用内联 Worker（Blob URL）
2. 简化 Worker 功能，只处理耗时操作

---

## 总结

### 已完成优化

| 优化项 | 状态 | 收益 |
|--------|------|------|
| AC 自动机缓存 | ✅ | 避免重复构建自动机，提升查询性能 |
| 样式滑动条防抖 | ✅ | 减少频繁重渲染，提升交互流畅度 |
| Web Worker 解析 | ⏸️ | 复杂度较高，可选实现 |

### 后续建议

1. **监控性能指标**：在实际使用中观察优化效果
2. **Web Worker**：如果长文章解析仍阻塞 UI，再考虑实现
3. **正则优化**：当前正则性能尚可，优先级较低
