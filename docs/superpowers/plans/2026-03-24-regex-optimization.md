# 正则表达式与渲染优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化 `processContent` 中的多次正则替换为单次遍历，提升 Markdown 渲染性能。

**Architecture:**
- 使用 DOM Parser 替代多次正则替换，单次遍历处理所有 Markdown 语法
- 保持向后兼容，不改变现有功能输出
- 添加性能计时以便对比优化效果

**Tech Stack:** TypeScript, DOM API

---

## Phase 1: 正则表达式优化

### Task 1.1: 分析当前正则性能问题

**Files:**
- Read: `src/views/parser.ts:216-330`

**背景：** 当前 `processContent` 方法使用 12 次独立的正则替换，每次都要遍历整个 HTML 字符串。可以优化为使用 DOM Parser 单次处理。

- [ ] **Step 1: 记录当前实现**

确认当前 `processContent` 方法中的正则替换：
1. 图片渲染（1次）
2. 标题渲染 h1-h6（6次）
3. 粗体渲染（2次）
4. 斜体渲染（2次）
5. 删除线渲染（1次）

共 12 次正则替换，每次 O(n) 复杂度。

### Task 1.2: 实现优化版 processContent

**Files:**
- Modify: `src/views/parser.ts:216-330`

- [ ] **Step 2: 创建优化版 processContentV2 方法**

在 `parser.ts` 中添加新的优化方法：

```typescript
    /**
     * 优化版 Markdown 语法处理
     * 使用 DOM Parser 单次遍历处理所有语法
     */
    processContentOptimized(htmlContent: string): string {
        // 创建临时 DOM 解析
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div class="article">${htmlContent}</div>`, 'text/html');
        const article = doc.querySelector('.article');
        if (!article) return htmlContent;

        // 处理所有段落
        const paragraphs = article.querySelectorAll('p');
        paragraphs.forEach(p => this.processParagraph(p));

        // 返回处理后的 HTML
        return article.innerHTML;
    }

    /**
     * 处理单个段落
     */
    private processParagraph(p: HTMLElement): void {
        const html = p.innerHTML;

        // 检查是否是图片段落
        const imgMatch = html.match(/!<span class="stns">\[(.*?)\]\((.*?)\)<\/span>/);
        if (imgMatch) {
            this.replaceWithImage(p, imgMatch[1], imgMatch[2]);
            return;
        }

        // 检查是否是标题
        const headerMatch = html.match(/^(#{1,6})\s+/);
        if (headerMatch) {
            this.replaceWithHeader(p, headerMatch[1].length, html);
            return;
        }

        // 处理段落内的粗体、斜体、删除线
        this.processInlineFormatting(p);
    }

    /**
     * 替换为图片
     */
    private replaceWithImage(p: HTMLElement, alt: string, src: string): void {
        const imgContainer = document.createElement('div');
        imgContainer.style.textAlign = 'center';
        const imgWrapper = document.createElement('div');
        imgWrapper.style.display = 'inline-block';
        const img = document.createElement('img');
        img.alt = alt;

        // 处理图片路径
        if (/^https?:\/\//.test(src)) {
            img.src = src;
        } else if (imgnum) {
            const str1 = imgnum;
            const str2 = src;
            const prefix = str2.substring(0, 3);
            const index = str1.indexOf(prefix);
            if (index !== -1 && index !== 0 && str1.charAt(index - 1) === '/') {
                const firstPart = str1.substring(0, index);
                img.src = firstPart + str2;
            } else {
                img.src = str1 + str2;
            }
        } else {
            img.src = src;
        }

        imgWrapper.appendChild(img);
        imgContainer.appendChild(imgWrapper);

        // 替换段落
        p.parentNode?.replaceChild(imgContainer, p);
    }

    /**
     * 替换为标题
     */
    private replaceWithHeader(p: HTMLElement, level: number, html: string): void {
        const header = document.createElement(`h${level}`);
        // 移除标题标记符号
        const content = html.replace(/^#{1,6}\s+/, '');
        header.innerHTML = `<span class="stns">${content}</span>`;
        p.parentNode?.replaceChild(header, p);
    }

    /**
     * 处理行内格式（粗体、斜体、删除线）
     */
    private processInlineFormatting(element: HTMLElement): void {
        let html = element.innerHTML;

        // 粗体 **text** 或 __text__
        html = html.replace(
            /\*\*((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)\*\*/g,
            '<strong>$1</strong>'
        );
        html = html.replace(
            /__((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)__/g,
            '<strong>$1</strong>'
        );

        // 斜体 *text* 或 _text_
        html = html.replace(
            /(?<!\*)\*(?!\*)((?:<span[^>]*>.*?<\/span>|\s|<[^>]+)+)\*(?!\*)/g,
            '<em>$1</em>'
        );
        html = html.replace(
            /(?<!_)_(?!_)((?:<span[^>]*>.*?<\/span>|\s|<[^>]+)+)_(?!_)/g,
            '<em>$1</em>'
        );

        // 删除线 ~~text~~
        html = html.replace(
            /~~((?:<span[^>]*>.*?<\/span>|\s|<[^>]+)+)~~/g,
            '<del>$1</del>'
        );

        element.innerHTML = html;
    }
```

- [ ] **Step 3: 添加性能计时功能（可选）**

```typescript
    /**
     * 带性能计时的 processContent
     */
    processContentWithTiming(htmlContent: string): string {
        const start = performance.now();
        const result = this.processContentOptimized(htmlContent);
        const duration = performance.now() - start;
        console.log(`[TextParser] processContent took ${duration.toFixed(2)}ms`);
        return result;
    }
```

- [ ] **Step 4: 修改 parse 方法使用优化版**

在 `parse` 方法中，替换原来的 `processContent` 调用：

```typescript
    async parse(data: string, options?: { useWorker?: boolean }): Promise<string> {
        // ... 检查缓存 ...

        if (options?.useWorker && data.length > 2000) {
            // ... Worker 解析 ...
        }

        // 先处理 Markdown 语法
        let processedData = this.preprocessMarkdown(data.trim());
        let newHTML = await this.text2HTML(processedData);

        // 使用优化版 processContent
        let html = this.processContentOptimized(newHTML);

        // 缓存结果
        cacheParseResult(data, html);
        return html;
    }
```

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
npx tsc --noEmit --skipLibCheck
```

预期：无错误

- [ ] **Step 6: 构建插件**

```bash
npm run build
```

预期：构建成功

- [ ] **Step 7: 功能测试**

1. 打开阅读模式
2. 测试以下 Markdown 语法是否正确渲染：
   - 标题 # ## ###
   - 粗体 **text**
   - 斜体 *text*
   - 删除线 ~~text~~
   - 图片 ![alt](url)
3. 对比优化前后的渲染结果

- [ ] **Step 8: Commit**

```bash
git add src/views/parser.ts
git commit -m "perf: 优化 processContent 使用 DOM Parser 单次遍历

- 新增 processContentOptimized 方法
- 使用 DOM Parser 替代多次正则替换
- 减少字符串遍历次数，提升性能"
```

---

## Phase 2: 虚拟滚动优化（可选/复杂）

### Task 2.1: 评估虚拟滚动需求

**背景：** 当前已实现分页机制，每页显示固定段落数。虚拟滚动适用于单页超长内容（>5000词）。

**决策：** 由于已有分页机制，虚拟滚动优先级较低。如需实现，需要考虑：
1. 估算每个单词的平均高度
2. 动态计算可见区域
3. 维护滚动位置状态

### Task 2.2: requestIdleCallback 优化（简单替代方案）

**Files:**
- Modify: `src/views/ReadingArea.vue`

- [ ] **Step 1: 添加 requestIdleCallback 工具函数**

在 `src/utils/helpers.ts` 中添加：

```typescript
/**
 * 使用 requestIdleCallback 或 setTimeout 延迟执行
 * 用于非关键任务的延迟处理
 */
export function runWhenIdle(callback: () => void, timeout?: number): void {
    if (typeof window.requestIdleCallback !== 'undefined') {
        window.requestIdleCallback(callback, { timeout });
    } else {
        setTimeout(callback, timeout || 1);
    }
}
```

- [ ] **Step 2: 延迟非关键统计更新**

在 `ReadingArea.vue` 中修改计数更新：

```typescript
// 计数
let unknown = ref(0);
let learn = ref(0);
let ignore = ref(0);
let countChange = ref(true);
let refreshCount = () => {
    countChange.value = !countChange.value;
};

if (plugin.settings.word_count) {
    watch(
        [countChange],
        async () => {
            // 使用 requestIdleCallback 延迟非关键统计
            runWhenIdle(async () => {
                [unknown.value, learn.value, ignore.value] =
                    await plugin.parser.countWords(article.join("\n"));
            }, 1000);
        },
        { immediate: true }
    );
    // ...
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/helpers.ts src/views/ReadingArea.vue
git commit -m "perf: 使用 requestIdleCallback 延迟非关键统计

- 添加 runWhenIdle 工具函数
- 延迟单词计数更新，优先保证阅读流畅度"
```

---

## 总结

### 已优化项（本次计划）

| 优化项 | 优先级 | 复杂度 | 预期收益 |
|--------|--------|--------|----------|
| DOM Parser 优化 | 中 | 中 | 减少多次正则遍历 |
| requestIdleCallback | 低 | 低 | 延迟非关键任务 |

### 已完成项（之前）

| 优化项 | 状态 |
|--------|------|
| AC 自动机缓存 | ✅ |
| 样式滑动条防抖 | ✅ |
| Web Worker 解析 | ✅ |

### 后续可选

| 优化项 | 优先级 | 说明 |
|--------|--------|------|
| 虚拟滚动 | 中 | 如需处理单页超长内容 |
| 代码分割 | 低 | 按需加载词典等模块 |
