# 热力图与日期追踪功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加单词创建日期和修改日期追踪，以及 GitHub 风格热力图侧边栏面板

**Architecture:** 扩展 Expression 数据模型添加 createdDate 和 modifiedDate 字段，数据库 schema 升级到 v2，新建热力图面板视图，自动管理日期字段

**Tech Stack:** TypeScript, Vue 3, Dexie (IndexedDB), Obsidian API

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/db/interface.ts` | 修改 | ExpressionInfo 添加 createdDate, modifiedDate |
| `src/db/idb.ts` | 修改 | 数据库 schema v2，添加新字段 |
| `src/db/local_db.ts` | 修改 | 添加按日期查询方法，更新保存逻辑 |
| `src/db/json_format.ts` | 修改 | JsonExpression 添加日期字段 |
| `src/db/json_serializer.ts` | 修改 | 序列化/反序列化新字段 |
| `src/views/HeatmapPanelView.ts` | 新建 | 热力图面板视图类 |
| `src/views/HeatmapPanel.vue` | 新建 | 热力图 Vue 组件 |
| `src/views/WordListByDate.vue` | 新建 | 按日期展示单词列表 |
| `src/plugin.ts` | 修改 | 注册热力图视图和按钮 |
| `src/lang/locale/zh.ts` | 修改 | 添加中文翻译 |
| `src/lang/locale/en.ts` | 修改 | 添加英文翻译 |
| `src/lang/locale/zh-TW.ts` | 修改 | 添加繁体中文翻译 |

---

## Task 1: 扩展数据接口类型定义

**Files:**
- Modify: `src/db/interface.ts`

**背景：** ExpressionInfo 需要添加 createdDate 和 modifiedDate 字段来追踪单词的创建和修改日期。

- [ ] **Step 1: 在 interface.ts 添加新字段**

修改 ExpressionInfo 接口（约第 43-51 行）：

```typescript
interface ExpressionInfo {
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    notes: string[];
    sentences: Sentence[];
    // 日期追踪字段
    createdDate: string;      // YYYY-MM-DD 格式，创建时设置，不可变
    modifiedDate: string;     // YYYY-MM-DD 格式，每次更新时刷新
}
```

修改 ExpressionInfoSimple 接口（约第 53-62 行）：

```typescript
interface ExpressionInfoSimple {
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    note_num: number;
    sen_num: number;
    date: number;
    // 日期追踪字段
    createdDate: string;
    modifiedDate: string;
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功（可能有类型错误，后续任务修复）
```

- [ ] **Step 3: Commit**

```bash
git add src/db/interface.ts
git commit -m "feat(types): add createdDate and modifiedDate to Expression interfaces"
```

---

## Task 2: 升级数据库 Schema

**Files:**
- Modify: `src/db/idb.ts`

**背景：** 需要升级数据库 schema 到 version 2，添加 createdDate 和 modifiedDate 字段的索引。

- [ ] **Step 1: 修改数据库 schema**

修改 WordDB 类（约第 11-28 行）：

```typescript
export default class WordDB extends Dexie {
    expressions: Dexie.Table<Expression, number>;
    sentences: Dexie.Table<Sentence, number>;
    plugin: Plugin;
    dbName: string;

    constructor(plugin: Plugin) {
        super(plugin.settings.db_name);
        this.plugin = plugin;
        this.dbName = plugin.settings.db_name;

        // 定义数据库 schema - version 1
        this.version(1).stores({
            expressions: "++id, &expression, status, t, date, *tags",
            sentences: "++id, &text"
        });

        // 升级到 version 2 - 添加日期字段
        this.version(2).stores({
            expressions: "++id, &expression, status, t, date, createdDate, modifiedDate, *tags",
            sentences: "++id, &text"
        }).upgrade(tx => {
            // 迁移现有数据：将 date 时间戳转换为日期字符串
            return tx.table("expressions").toCollection().modify(expr => {
                const dateStr = new Date(expr.date * 1000).toISOString().split('T')[0];
                expr.createdDate = dateStr;
                expr.modifiedDate = dateStr;
            });
        });
    }
}
```

修改 Expression 接口（约第 31-42 行）：

```typescript
interface Expression {
    id?: number,
    expression: string,
    meaning: string,
    status: number,
    t: string,
    date: number,
    createdDate: string,      // YYYY-MM-DD
    modifiedDate: string,     // YYYY-MM-DD
    notes: string[],
    tags: Set<string>,
    sentences: Set<number>,
    connections: Map<string, string>,
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/db/idb.ts
git commit -m "feat(db): upgrade schema to v2 with createdDate and modifiedDate"
```

---

## Task 3: 更新 JSON 格式类型定义

**Files:**
- Modify: `src/db/json_format.ts`

**背景：** JSON 同步格式也需要包含新的日期字段。

- [ ] **Step 1: 修改 JsonExpression 接口**

修改 JsonExpression 接口（约第 60-79 行），添加日期字段：

```typescript
export interface JsonExpression {
    /** 自增 ID（JSON 文件中可选，主要用于关联句子） */
    id: number;
    /** 单词/短语文本（小写） */
    expression: string;
    /** 释义 */
    meaning: string;
    /** 学习状态: 0=Ignore, 1=Learning, 2=Familiar, 3=Known, 4=Learned */
    status: number;
    /** 类型: WORD | PHRASE */
    t: 'WORD' | 'PHRASE';
    /** 创建/更新时间 (Unix timestamp) */
    date: number;
    /** 创建日期 (YYYY-MM-DD) */
    createdDate: string;
    /** 最后修改日期 (YYYY-MM-DD) */
    modifiedDate: string;
    /** 笔记 */
    notes: string[];
    /** 标签 */
    tags: string[];
    /** 关联的例句 ID 列表 */
    sentenceIds: number[];
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/db/json_format.ts
git commit -m "feat(json): add createdDate and modifiedDate to JsonExpression"
```

---

## Task 4: 更新序列化逻辑

**Files:**
- Modify: `src/db/json_serializer.ts`

**背景：** 需要更新序列化/反序列化函数以处理新的日期字段。

- [ ] **Step 1: 修改 serializeExpression 函数**

修改 serializeExpression 函数（约第 40-55 行）：

```typescript
export function serializeExpression(
    expr: InternalExpression,
    id: number
): JsonExpression {
    return {
        id,
        expression: expr.expression,
        meaning: expr.meaning,
        status: expr.status,
        t: expr.t as 'WORD' | 'PHRASE',
        date: expr.date,
        createdDate: expr.createdDate || new Date(expr.date * 1000).toISOString().split('T')[0],
        modifiedDate: expr.modifiedDate || new Date(expr.date * 1000).toISOString().split('T')[0],
        notes: expr.notes || [],
        tags: expr.tags ? [...expr.tags] : [],
        sentenceIds: expr.sentences ? [...expr.sentences] : []
    };
}
```

- [ ] **Step 2: 修改 deserializeExpression 函数**

修改 deserializeExpression 函数（约第 62-75 行）：

```typescript
export function deserializeExpression(json: JsonExpression): InternalExpression {
    return {
        id: json.id,
        expression: json.expression,
        meaning: json.meaning,
        status: json.status,
        t: json.t,
        date: json.date,
        createdDate: json.createdDate || new Date(json.date * 1000).toISOString().split('T')[0],
        modifiedDate: json.modifiedDate || new Date(json.date * 1000).toISOString().split('T')[0],
        notes: json.notes || [],
        tags: new Set(json.tags || []),
        sentences: new Set(json.sentenceIds || []),
        connections: new Map()
    };
}
```

- [ ] **Step 3: 修改 expressionInfoToJson 函数**

修改 expressionInfoToJson 函数（约第 106-133 行），添加日期字段处理：

```typescript
export function expressionInfoToJson(
    expr: ExpressionInfo,
    id: number,
    sentenceIdMap: Map<string, number>
): JsonExpression {
    // 为句子分配 ID
    const sentenceIds = expr.sentences.map(s => {
        const key = s.text;
        if (sentenceIdMap.has(key)) {
            return sentenceIdMap.get(key)!;
        }
        const newId = sentenceIdMap.size + 1;
        sentenceIdMap.set(key, newId);
        return newId;
    });

    const today = new Date().toISOString().split('T')[0];

    return {
        id,
        expression: expr.expression.toLowerCase(),
        meaning: expr.meaning,
        status: expr.status,
        t: expr.t as 'WORD' | 'PHRASE',
        date: Math.floor(Date.now() / 1000),
        createdDate: expr.createdDate || today,
        modifiedDate: expr.modifiedDate || today,
        notes: expr.notes || [],
        tags: expr.tags || [],
        sentenceIds
    };
}
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 5: Commit**

```bash
git add src/db/json_serializer.ts
git commit -m "feat(serializer): handle createdDate and modifiedDate in serialization"
```

---

## Task 5: 更新 LocalDb 日期管理逻辑

**Files:**
- Modify: `src/db/local_db.ts`

**背景：** 需要在保存单词时自动设置 createdDate 和 modifiedDate，并提供按日期查询的方法。

- [ ] **Step 1: 找到 getExpression 方法并修改返回数据**

在 getExpression 方法（约第 140-160 行附近）中，确保返回的数据包含日期字段：

```typescript
async getExpression(expression: string): Promise<ExpressionInfo | null> {
    let expr = await this.idb.expressions
        .where("expression")
        .equals(expression.toLowerCase())
        .first();
    if (!expr) return null;

    // ... 获取句子等逻辑 ...

    return {
        expression: expr.expression,
        meaning: expr.meaning,
        status: expr.status,
        t: expr.t,
        tags: [...expr.tags],
        notes: expr.notes,
        sentences: /* ... */,
        createdDate: expr.createdDate || new Date(expr.date * 1000).toISOString().split('T')[0],
        modifiedDate: expr.modifiedDate || new Date(expr.date * 1000).toISOString().split('T')[0],
    };
}
```

- [ ] **Step 2: 修改 postExpression 方法自动管理日期**

修改 postExpression 方法（约第 200-250 行），在保存时自动设置日期：

```typescript
async postExpression(payload: ExpressionInfo): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    // 检查是否已存在
    let existing = await this.idb.expressions
        .where("expression")
        .equals(payload.expression.toLowerCase())
        .first();

    // 准备表达式数据
    let expr: Expression = {
        expression: payload.expression.toLowerCase(),
        meaning: payload.meaning,
        status: payload.status,
        t: payload.t,
        date: Math.floor(Date.now() / 1000),
        // 日期管理：新建时设置 createdDate，始终更新 modifiedDate
        createdDate: existing?.createdDate || payload.createdDate || today,
        modifiedDate: today,
        notes: payload.notes || [],
        tags: new Set(payload.tags || []),
        sentences: new Set(/* ... */),
        connections: new Map(),
    };

    // ... 保存逻辑 ...
}
```

- [ ] **Step 3: 添加按日期查询方法**

在 local_db.ts 中添加新方法（在 getHeatmapData 方法之后）：

```typescript
/**
 * 获取指定日期创建的单词
 */
async getExpressionsByDate(date: string): Promise<ExpressionInfo[]> {
    let expressions: ExpressionInfo[] = [];

    await this.idb.expressions
        .where("createdDate")
        .equals(date)
        .each(expr => {
            expressions.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                tags: [...expr.tags],
                notes: expr.notes,
                sentences: [], // 简化版，不加载句子
                createdDate: expr.createdDate,
                modifiedDate: expr.modifiedDate,
            });
        });

    return expressions;
}

/**
 * 获取日期范围内的单词
 */
async getExpressionsByDateRange(start: string, end: string): Promise<ExpressionInfo[]> {
    let expressions: ExpressionInfo[] = [];

    await this.idb.expressions
        .where("createdDate")
        .between(start, end, true, true)
        .each(expr => {
            expressions.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                tags: [...expr.tags],
                notes: expr.notes,
                sentences: [],
                createdDate: expr.createdDate,
                modifiedDate: expr.modifiedDate,
            });
        });

    return expressions;
}
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 5: Commit**

```bash
git add src/db/local_db.ts
git commit -m "feat(db): auto-manage createdDate/modifiedDate, add date query methods"
```

---

## Task 6: 创建热力图面板视图

**Files:**
- Create: `src/views/HeatmapPanelView.ts`

**背景：** 创建一个新的面板视图类，用于展示 GitHub 风格的热力图。

- [ ] **Step 1: 创建 HeatmapPanelView.ts**

```typescript
/**
 * 学习热力图面板视图
 * 展示 GitHub 风格的年度学习热力图
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createApp, App as VueApp } from "vue";
import LanguageLearner from "@/plugin";
import { t } from "@/lang/helper";
import HeatmapPanel from "./HeatmapPanel.vue";

export const HEATMAP_PANEL_VIEW = "heatmap-panel-view";
export const HEATMAP_ICON = "flame"; // Lucide flame icon

export class HeatmapPanelView extends ItemView {
    plugin: LanguageLearner;
    vueApp: VueApp | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return HEATMAP_PANEL_VIEW;
    }

    getDisplayText(): string {
        return t("Learning Heatmap");
    }

    getIcon(): string {
        return HEATMAP_ICON;
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // 创建挂载点
        const mountPoint = container.createDiv({ cls: "heatmap-panel-container" });
        mountPoint.style.height = "100%";

        // 挂载 Vue 应用
        this.vueApp = createApp(HeatmapPanel);
        this.vueApp.config.globalProperties.view = this;
        this.vueApp.config.globalProperties.plugin = this.plugin;
        this.vueApp.mount(mountPoint);
    }

    async onClose(): Promise<void> {
        if (this.vueApp) {
            this.vueApp.unmount();
            this.vueApp = null;
        }
    }
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/views/HeatmapPanelView.ts
git commit -m "feat(view): add HeatmapPanelView for learning activity heatmap"
```

---

## Task 7: 创建热力图 Vue 组件

**Files:**
- Create: `src/views/HeatmapPanel.vue`

**背景：** 创建 GitHub 风格的热力图组件，展示每日学习单词量。

- [ ] **Step 1: 创建 HeatmapPanel.vue**

```vue
<template>
    <div class="heatmap-panel">
        <!-- 标题和统计 -->
        <div class="heatmap-header">
            <h3>{{ t("Learning Heatmap") }}</h3>
            <div class="heatmap-stats">
                <div class="stat-item">
                    <span class="stat-value">{{ stats.totalLearned }}</span>
                    <span class="stat-label">{{ t("Total Words") }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">{{ stats.currentStreak }}</span>
                    <span class="stat-label">{{ t("Current Streak") }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">{{ stats.longestStreak }}</span>
                    <span class="stat-label">{{ t("Longest Streak") }}</span>
                </div>
            </div>
        </div>

        <!-- 年份选择 -->
        <div class="year-selector">
            <button @click="changeYear(-1)">←</button>
            <span>{{ currentYear }}</span>
            <button @click="changeYear(1)">→</button>
        </div>

        <!-- 热力图网格 -->
        <div class="heatmap-grid-container">
            <div class="heatmap-grid">
                <!-- 星期标签 -->
                <div class="weekday-labels">
                    <span v-for="day in weekdayLabels" :key="day">{{ day }}</span>
                </div>

                <!-- 月份标签 -->
                <div class="month-labels">
                    <span v-for="month in monthLabels" :key="month">{{ month }}</span>
                </div>

                <!-- 热力图格子 -->
                <div class="heatmap-cells">
                    <div
                        v-for="cell in heatmapCells"
                        :key="cell.date"
                        class="heatmap-cell"
                        :class="`level-${cell.level}`"
                        :title="`${cell.date}: ${cell.count} ${t('words')}`"
                        @click="selectDate(cell.date)"
                    ></div>
                </div>
            </div>
        </div>

        <!-- 图例 -->
        <div class="heatmap-legend">
            <span>{{ t("Less") }}</span>
            <div class="legend-cells">
                <div v-for="i in 5" :key="i" class="legend-cell" :class="`level-${i-1}`"></div>
            </div>
            <span>{{ t("More") }}</span>
        </div>

        <!-- 选中日期的单词列表 -->
        <div v-if="selectedDate" class="word-list-section">
            <h4>{{ selectedDate }} ({{ selectedDateWords.length }} {{ t("words") }})</h4>
            <WordListByDate :words="selectedDateWords" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { moment } from "obsidian";
import { t } from "@/lang/helper";
import type { HeatmapStats, HeatmapData, ExpressionInfo } from "@/db/interface";
import WordListByDate from "./WordListByDate.vue";

// 获取插件实例
const plugin = (window as any).app.plugins.plugins["obsidian-language-learner"];

const currentYear = ref(new Date().getFullYear());
const heatmapData = ref<HeatmapData[]>([]);
const stats = ref<HeatmapStats>({
    totalDays: 0,
    totalLearned: 0,
    longestStreak: 0,
    currentStreak: 0,
    data: [],
    startDate: "",
    endDate: ""
});
const selectedDate = ref<string | null>(null);
const selectedDateWords = ref<ExpressionInfo[]>([]);

const weekdayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 生成热力图格子
const heatmapCells = computed(() => {
    const cells: HeatmapData[] = [];
    const startOfYear = moment(`${currentYear.value}-01-01`);
    const endOfYear = moment(`${currentYear.value}-12-31`);

    // 找到第一个星期日（或周一，根据你的偏好）
    let current = startOfYear.clone().startOf("week");

    while (current.isSameOrBefore(endOfYear, "day")) {
        const dateStr = current.format("YYYY-MM-DD");
        const data = heatmapData.value.find(d => d.date === dateStr);

        cells.push({
            date: dateStr,
            count: data?.count || 0,
            level: data?.level || 0
        });

        current.add(1, "day");
    }

    return cells;
});

// 加载热力图数据
async function loadHeatmapData() {
    if (!plugin?.db) return;

    const result = await plugin.db.getHeatmapData(currentYear.value);
    stats.value = result;
    heatmapData.value = result.data;
}

// 切换年份
function changeYear(delta: number) {
    currentYear.value += delta;
    loadHeatmapData();
}

// 选择日期
async function selectDate(date: string) {
    selectedDate.value = date;
    if (!plugin?.db) return;

    // 加载该日期的单词
    const words = await plugin.db.getExpressionsByDate(date);
    selectedDateWords.value = words;
}

onMounted(() => {
    loadHeatmapData();
});
</script>

<style scoped>
.heatmap-panel {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
}

.heatmap-header {
    margin-bottom: 20px;
}

.heatmap-header h3 {
    margin-bottom: 12px;
}

.heatmap-stats {
    display: flex;
    gap: 24px;
}

.stat-item {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: var(--text-accent);
}

.stat-label {
    font-size: 12px;
    color: var(--text-muted);
}

.year-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.year-selector button {
    background: var(--background-modifier-hover);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 4px;
}

.heatmap-grid-container {
    overflow-x: auto;
    margin-bottom: 16px;
}

.heatmap-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px;
}

.weekday-labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 10px;
    color: var(--text-muted);
}

.weekday-labels span {
    height: 12px;
    line-height: 12px;
}

.heatmap-cells {
    display: grid;
    grid-template-columns: repeat(53, 12px);
    gap: 2px;
}

.heatmap-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background-color: var(--background-modifier-border);
    cursor: pointer;
    transition: opacity 0.2s;
}

.heatmap-cell:hover {
    opacity: 0.8;
    outline: 1px solid var(--text-accent);
}

.level-0 { background-color: var(--background-modifier-border); }
.level-1 { background-color: #9be9a8; }
.level-2 { background-color: #40c463; }
.level-3 { background-color: #30a14e; }
.level-4 { background-color: #216e39; }

.heatmap-legend {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
}

.legend-cells {
    display: flex;
    gap: 2px;
}

.legend-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.word-list-section {
    margin-top: 24px;
    border-top: 1px solid var(--background-modifier-border);
    padding-top: 16px;
}

.word-list-section h4 {
    margin-bottom: 12px;
}
</style>
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/views/HeatmapPanel.vue
git commit -m "feat(ui): add HeatmapPanel Vue component with GitHub-style heatmap"
```

---

## Task 8: 创建按日期单词列表组件

**Files:**
- Create: `src/views/WordListByDate.vue`

**背景：** 创建展示特定日期单词列表的组件。

- [ ] **Step 1: 创建 WordListByDate.vue**

```vue
<template>
    <div class="word-list-by-date">
        <div v-if="words.length === 0" class="empty-state">
            {{ t("No words recorded on this date") }}
        </div>
        <div v-else class="word-list">
            <div
                v-for="word in words"
                :key="word.expression"
                class="word-item"
                :class="`status-${word.status}`"
            >
                <div class="word-header">
                    <span class="word-text">{{ word.expression }}</span>
                    <span class="word-type">{{ word.t === "WORD" ? t("Word") : t("Phrase") }}</span>
                    <span class="word-status" :style="getStatusStyle(word.status)">
                        {{ getStatusLabel(word.status) }}
                    </span>
                </div>
                <div class="word-meaning">{{ word.meaning }}</div>
                <div class="word-meta">
                    <span class="meta-item">
                        <span class="meta-label">{{ t("Created") }}:</span>
                        {{ word.createdDate }}
                    </span>
                    <span class="meta-item">
                        <span class="meta-label">{{ t("Modified") }}:</span>
                        {{ word.modifiedDate }}
                    </span>
                    <span v-if="word.tags.length > 0" class="meta-item">
                        <span class="meta-label">{{ t("Tags") }}:</span>
                        {{ word.tags.join(", ") }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { t } from "@/lang/helper";
import type { ExpressionInfo } from "@/db/interface";

const props = defineProps<{
    words: ExpressionInfo[];
}>();

const statusLabels = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned")
];

const statusColors = [
    "#999999", // Ignore
    "#e74c3c", // Learning
    "#f39c12", // Familiar
    "#3498db", // Known
    "#27ae60"  // Learned
];

function getStatusLabel(status: number): string {
    return statusLabels[status] || t("Unknown");
}

function getStatusStyle(status: number) {
    return {
        backgroundColor: statusColors[status] || "#999999",
        color: "white",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px"
    };
}
</script>

<style scoped>
.word-list-by-date {
    max-height: 400px;
    overflow-y: auto;
}

.empty-state {
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
    font-style: italic;
}

.word-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.word-item {
    padding: 12px;
    border-radius: 6px;
    background-color: var(--background-secondary);
    border-left: 3px solid transparent;
}

.word-item.status-1 { border-left-color: #e74c3c; }
.word-item.status-2 { border-left-color: #f39c12; }
.word-item.status-3 { border-left-color: #3498db; }
.word-item.status-4 { border-left-color: #27ae60; }

.word-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}

.word-text {
    font-weight: bold;
    font-size: 16px;
}

.word-type {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--background-modifier-hover);
    padding: 2px 6px;
    border-radius: 3px;
}

.word-meaning {
    font-size: 14px;
    color: var(--text-normal);
    margin-bottom: 8px;
    line-height: 1.4;
}

.word-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--text-muted);
}

.meta-item {
    display: flex;
    gap: 4px;
}

.meta-label {
    font-weight: 500;
}
</style>
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/views/WordListByDate.vue
git commit -m "feat(ui): add WordListByDate component for displaying words by date"
```

---

## Task 9: 注册热力图视图和按钮

**Files:**
- Modify: `src/plugin.ts`

**背景：** 在插件主类中注册热力图面板视图和侧边栏按钮。

- [ ] **Step 1: 导入 HeatmapPanelView**

在 plugin.ts 的导入部分（约第 26-34 行）添加：

```typescript
import { HeatmapPanelView, HEATMAP_PANEL_VIEW, HEATMAP_ICON } from "./views/HeatmapPanelView";
```

- [ ] **Step 2: 在 registerCustomViews 中注册视图**

在 registerCustomViews 方法中（约第 502-510 行之后）添加：

```typescript
// 注册学习热力图面板
this.registerView(
    HEATMAP_PANEL_VIEW,
    (leaf) => new HeatmapPanelView(leaf, this)
);
this.addRibbonIcon(HEATMAP_ICON, t("Learning Heatmap"), (evt) => {
    this.activateView(HEATMAP_PANEL_VIEW, "right");
});
```

- [ ] **Step 3: 在 onunload 中清理视图**

在 onunload 方法中（约第 145-161 行）添加：

```typescript
this.app.workspace.detachLeavesOfType(HEATMAP_PANEL_VIEW);
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 5: Commit**

```bash
git add src/plugin.ts
git commit -m "feat(plugin): register HeatmapPanelView and ribbon icon"
```

---

## Task 10: 添加翻译键

**Files:**
- Modify: `src/lang/locale/zh.ts`
- Modify: `src/lang/locale/en.ts`
- Modify: `src/lang/locale/zh-TW.ts`

**背景：** 为热力图功能添加多语言翻译。

- [ ] **Step 1: 在 zh.ts 添加翻译**

在文件末尾（约第 350 行之后）添加：

```typescript
    // Heatmap Panel
    "Learning Heatmap": "学习热力图",
    "Total Words": "总单词数",
    "Current Streak": "当前连续",
    "Longest Streak": "最长连续",
    "Less": "少",
    "More": "多",
    "No words recorded on this date": "该日期没有记录单词",
    "Created": "创建",
    "Modified": "修改",
```

- [ ] **Step 2: 在 en.ts 添加翻译**

```typescript
    // Heatmap Panel
    "Learning Heatmap": "Learning Heatmap",
    "Total Words": "Total Words",
    "Current Streak": "Current Streak",
    "Longest Streak": "Longest Streak",
    "Less": "Less",
    "More": "More",
    "No words recorded on this date": "No words recorded on this date",
    "Created": "Created",
    "Modified": "Modified",
```

- [ ] **Step 3: 在 zh-TW.ts 添加翻译**

```typescript
    // Heatmap Panel
    "Learning Heatmap": "學習熱力圖",
    "Total Words": "總單詞數",
    "Current Streak": "當前連續",
    "Longest Streak": "最長連續",
    "Less": "少",
    "More": "多",
    "No words recorded on this date": "該日期沒有記錄單詞",
    "Created": "創建",
    "Modified": "修改",
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 5: Commit**

```bash
git add src/lang/locale/*.ts
git commit -m "feat(i18n): add translations for heatmap panel"
```

---

## Task 11: 更新数据库基类接口

**Files:**
- Modify: `src/db/base.ts`

**背景：** 在数据库基类中添加新的抽象方法声明。

- [ ] **Step 1: 在 base.ts 添加新方法声明**

在 DbProvider 抽象类中添加（约第 25-46 行）：

```typescript
abstract class DbProvider {
    abstract open(): Promise<void>;
    abstract close(): void;
    // ... 现有方法 ...

    // 按日期查询单词
    abstract getExpressionsByDate(date: string): Promise<ExpressionInfo[]>;
    abstract getExpressionsByDateRange(start: string, end: string): Promise<ExpressionInfo[]>;
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/db/base.ts
git commit -m "feat(db): add date query methods to DbProvider base class"
```

---

## Task 12: 更新 WebDb 实现

**Files:**
- Modify: `src/db/web_db.ts`

**背景：** 如果是远程服务器模式，也需要实现日期查询方法（可以暂时抛出错误或返回空数组）。

- [ ] **Step 1: 在 web_db.ts 添加方法**

在 WebDb 类中添加：

```typescript
async getExpressionsByDate(date: string): Promise<ExpressionInfo[]> {
    // WebDb 暂不支持按日期查询，返回空数组
    console.warn("[WebDb] getExpressionsByDate not implemented");
    return [];
}

async getExpressionsByDateRange(start: string, end: string): Promise<ExpressionInfo[]> {
    // WebDb 暂不支持按日期范围查询
    console.warn("[WebDb] getExpressionsByDateRange not implemented");
    return [];
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/db/web_db.ts
git commit -m "feat(db): stub date query methods in WebDb"
```

---

## Task 13: 更新 JsonSyncDb

**Files:**
- Modify: `src/db/json_sync_db.ts`

**背景：** JSON 同步数据库也需要实现日期查询方法，委托给本地数据库。

- [ ] **Step 1: 在 json_sync_db.ts 添加方法**

在 JsonSyncDb 类中添加（在 getLocalDb 方法之后）：

```typescript
/**
 * 获取指定日期创建的单词
 */
async getExpressionsByDate(date: string): Promise<ExpressionInfo[]> {
    return this.localDb.getExpressionsByDate(date);
}

/**
 * 获取日期范围内的单词
 */
async getExpressionsByDateRange(start: string, end: string): Promise<ExpressionInfo[]> {
    return this.localDb.getExpressionsByDateRange(start, end);
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/db/json_sync_db.ts
git commit -m "feat(db): delegate date queries to localDb in JsonSyncDb"
```

---

## Task 14: 更新 getHeatmapData 使用新字段

**Files:**
- Modify: `src/db/local_db.ts`

**背景：** 更新现有的 getHeatmapData 方法，使用新的 createdDate 字段而不是 date 时间戳。

- [ ] **Step 1: 修改 getHeatmapData 方法**

修改 getHeatmapData 方法（约第 345-420 行）：

```typescript
async getHeatmapData(year?: number): Promise<HeatmapStats> {
    const targetYear = year || new Date().getFullYear();

    // 获取指定年份的单词
    let allExpressions: { createdDate: string; status: number }[] = [];
    await this.idb.expressions
        .filter(expr => expr.t === "WORD" && expr.status > 0)
        .each(expr => {
            allExpressions.push({ createdDate: expr.createdDate, status: expr.status });
        });

    if (allExpressions.length === 0) {
        return {
            totalDays: 0,
            totalLearned: 0,
            longestStreak: 0,
            currentStreak: 0,
            data: [],
            startDate: moment().format("YYYY-MM-DD"),
            endDate: moment().format("YYYY-MM-DD"),
        };
    }

    // 按日期分组统计（使用 createdDate）
    let dateMap = new Map<string, number>();
    for (let expr of allExpressions) {
        // 只统计目标年份的数据
        if (expr.createdDate.startsWith(String(targetYear))) {
            dateMap.set(expr.createdDate, (dateMap.get(expr.createdDate) || 0) + 1);
        }
    }

    // 生成整年的热力图数据
    let heatmapData: HeatmapData[] = [];
    const startOfYear = moment(`${targetYear}-01-01`);
    const endOfYear = moment(`${targetYear}-12-31`);
    let current = startOfYear.clone();
    let maxCount = 0;

    while (current.isSameOrBefore(endOfYear)) {
        let dateStr = current.format("YYYY-MM-DD");
        let count = dateMap.get(dateStr) || 0;
        heatmapData.push({
            date: dateStr,
            count: count,
            level: 0,
        });
        if (count > maxCount) {
            maxCount = count;
        }
        current.add(1, "day");
    }

    // 计算强度等级
    for (let data of heatmapData) {
        if (data.count === 0) {
            data.level = 0;
        } else if (maxCount <= 4) {
            data.level = data.count;
        } else {
            let ratio = data.count / maxCount;
            if (ratio <= 0.25) data.level = 1;
            else if (ratio <= 0.5) data.level = 2;
            else if (ratio <= 0.75) data.level = 3;
            else data.level = 4;
        }
    }

    // 计算连续学习天数
    let longestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 0;
    let isCurrent = true;

    for (let i = heatmapData.length - 1; i >= 0; i--) {
        if (heatmapData[i].count > 0) {
            tempStreak++;
            if (isCurrent) {
                currentStreak = tempStreak;
            }
        } else {
            if (tempStreak > longestStreak) {
                longestStreak = tempStreak;
            }
            tempStreak = 0;
            isCurrent = false;
        }
    }
    if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
    }

    return {
        totalDays: dateMap.size,
        totalLearned: allExpressions.length,
        longestStreak,
        currentStreak,
        data: heatmapData,
        startDate: startOfYear.format("YYYY-MM-DD"),
        endDate: endOfYear.format("YYYY-MM-DD"),
    };
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 3: Commit**

```bash
git add src/db/local_db.ts
git commit -m "feat(db): update getHeatmapData to use createdDate field"
```

---

## Task 15: 最终验证和提交

- [ ] **Step 1: 完整构建验证**

```bash
npm run build
# Expected: 构建成功，无错误
```

- [ ] **Step 2: 检查构建产物**

```bash
ls -lh main.js main.css
# Expected: main.js 和 main.css 存在且大小合理
```

- [ ] **Step 3: 最终提交（如果之前已分别提交，此步骤可选）**

```bash
git log --oneline -5
# 确认提交历史
```

---

## 测试清单

功能实现后，手动测试以下场景：

- [ ] 打开热力图面板（侧边栏 flame 图标）
- [ ] 查看年度热力图显示正常
- [ ] 点击日期格子显示该日单词列表
- [ ] 切换年份（上一年/下一年）
- [ ] 添加新单词，createdDate 自动设置为今天
- [ ] 修改现有单词，modifiedDate 更新为今天
- [ ] 检查统计信息（总单词数、连续天数）
- [ ] 验证多语言显示正常

## 注意事项

1. **数据库迁移**：首次打开插件时会自动执行数据库升级（v1 → v2），将现有数据的 date 字段转换为 createdDate 和 modifiedDate。

2. **向后兼容**：保留原有的 `date` 字段以确保兼容性，新功能使用 `createdDate` 和 `modifiedDate`。

3. **性能**：热力图数据按年份加载，避免一次性加载过多数据。

4. **样式**：热力图使用 GitHub 风格的绿色渐变，根据每日学习量自动计算颜色深度。
