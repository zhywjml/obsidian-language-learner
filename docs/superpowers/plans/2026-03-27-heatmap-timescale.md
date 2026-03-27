# 热力图时间尺度扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展热力图面板支持月份网格视图和多年对比视图，让用户能够多维度查看学习历史数据。

**Architecture:** 通过新增数据查询接口获取月度/年度统计，创建独立的 Vue 组件分别处理月份网格和多年对比视图，通过视图切换机制整合到现有 HeatmapPanel 中。

**Tech Stack:** TypeScript, Vue 3, SCSS, Dexie (IndexedDB), Obsidian API

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/db/interface.ts` | 修改 | 添加 MonthlyStats, YearlyStats 接口定义 |
| `src/db/base.ts` | 修改 | 添加抽象方法声明 |
| `src/db/local_db.ts` | 修改 | 实现月度/年度统计查询方法 |
| `src/db/web_db.ts` | 修改 | 添加 stub 方法 |
| `src/db/json_sync_db.ts` | 修改 | 委托查询到 localDb |
| `src/views/MonthGrid.vue` | 新建 | 月份网格视图组件 (3x4 布局) |
| `src/views/MultiYearView.vue` | 新建 | 多年对比视图组件 |
| `src/views/HeatmapPanel.vue` | 修改 | 整合视图切换和新组件 |
| `src/lang/locale/zh.ts` | 修改 | 添加中文翻译 |
| `src/lang/locale/en.ts` | 修改 | 添加英文翻译 |
| `src/lang/locale/zh-TW.ts` | 修改 | 添加繁体中文翻译 |

---

## Task 1: 添加数据接口类型定义

**Files:**
- Modify: `src/db/interface.ts`

**背景:** 需要定义 MonthlyStats 和 YearlyStats 接口来描述月度/年度统计数据结构。

- [ ] **Step 1: 在 interface.ts 添加新接口**

在文件末尾（HeatmapStats 之后）添加以下接口定义：

```typescript
// 月度统计信息
interface MonthlyStats {
    month: number;      // 1-12
    year: number;
    totalWords: number; // 该月总学习单词数
    daysWithActivity: number; // 有学习活动的天数
}

// 年度统计信息
interface YearlyStats {
    year: number;
    totalWords: number;     // 全年总学习单词数
    totalDays: number;      // 全年天数（通常365/366）
    longestStreak: number;  // 最长连续学习天数
    monthlyData: MonthlyStats[]; // 各月数据
}
```

- [ ] **Step 2: 更新导出类型列表**

在文件底部的 export type 语句中添加新类型：

```typescript
export type {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapData, HeatmapStats,
    MonthlyStats, YearlyStats  // 新增
};
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 4: Commit**

```bash
git add src/db/interface.ts
git commit -m "feat(types): add MonthlyStats and YearlyStats interfaces"
```

---

## Task 2: 更新数据库基类

**Files:**
- Modify: `src/db/base.ts`

**背景:** 在抽象基类中添加新方法声明，所有数据库实现必须提供这些方法。

- [ ] **Step 1: 导入新类型**

修改导入语句：

```typescript
import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapStats,
    MonthlyStats, YearlyStats  // 新增
} from "./interface";
```

- [ ] **Step 2: 添加抽象方法**

在 DbProvider 类的末尾（destroyAll 方法之前）添加：

```typescript
    // 获取指定年份的月度统计
    abstract getMonthlyStats(year: number): Promise<MonthlyStats[]>;

    // 获取多个年份的年度统计
    abstract getYearlyStats(years: number[]): Promise<YearlyStats[]>;

    // 获取数据库中有数据的年份列表
    abstract getAvailableYears(): Promise<number[]>;
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 4: Commit**

```bash
git add src/db/base.ts
git commit -m "feat(db): add monthly/yearly stats methods to base class"
```

---

## Task 3: 实现 LocalDb 统计查询方法

**Files:**
- Modify: `src/db/local_db.ts`

**背景:** 实现具体的月度/年度统计查询逻辑，使用 IndexedDB 按日期聚合数据。

- [ ] **Step 1: 导入新类型**

修改导入语句：

```typescript
import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapData, HeatmapStats,
    MonthlyStats, YearlyStats  // 新增
} from "./interface";
```

- [ ] **Step 2: 添加 getMonthlyStats 方法**

在 getHeatmapData 方法之后添加：

```typescript
    /**
     * 获取指定年份的月度统计
     */
    async getMonthlyStats(year: number): Promise<MonthlyStats[]> {
        const monthlyData: MonthlyStats[] = [];

        // 初始化12个月的数据
        for (let month = 1; month <= 12; month++) {
            monthlyData.push({
                month,
                year,
                totalWords: 0,
                daysWithActivity: 0
            });
        }

        // 获取该年份的所有单词（按 createdDate）
        const startOfYear = moment().year(year).startOf("year");
        const endOfYear = moment().year(year).endOf("year");
        const startUnix = startOfYear.unix();
        const endUnix = endOfYear.unix();

        // 按日期分组统计
        const dateMap = new Map<string, number>();

        await this.idb.expressions
            .where("date")
            .between(startUnix, endUnix, true, true)
            .and(expr => expr.status > 0)
            .each(expr => {
                // 使用 createdDate 或从 date 字段转换
                const dateStr = expr.createdDate || moment.unix(expr.date).format("YYYY-MM-DD");
                const month = parseInt(dateStr.split("-")[1]);

                monthlyData[month - 1].totalWords++;

                // 统计有活动的天数
                if (!dateMap.has(dateStr)) {
                    dateMap.set(dateStr, 0);
                    monthlyData[month - 1].daysWithActivity++;
                }
                dateMap.set(dateStr, dateMap.get(dateStr) + 1);
            });

        return monthlyData;
    }
```

- [ ] **Step 3: 添加 getYearlyStats 方法**

```typescript
    /**
     * 获取多个年份的年度统计
     */
    async getYearlyStats(years: number[]): Promise<YearlyStats[]> {
        const results: YearlyStats[] = [];

        for (const year of years) {
            const monthlyData = await this.getMonthlyStats(year);
            const totalWords = monthlyData.reduce((sum, m) => sum + m.totalWords, 0);

            // 计算最长连续学习天数（基于年视图逻辑）
            const heatmapData = await this.getHeatmapData(year);

            results.push({
                year,
                totalWords,
                totalDays: monthlyData.reduce((sum, m) => sum + m.daysWithActivity, 0),
                longestStreak: heatmapData.longestStreak,
                monthlyData
            });
        }

        return results;
    }
```

- [ ] **Step 4: 添加 getAvailableYears 方法**

```typescript
    /**
     * 获取数据库中有数据的年份列表
     */
    async getAvailableYears(): Promise<number[]> {
        const years = new Set<number>();

        await this.idb.expressions
            .where("status").above(0)
            .each(expr => {
                const year = expr.createdDate
                    ? parseInt(expr.createdDate.split("-")[0])
                    : moment.unix(expr.date).year();
                years.add(year);
            });

        return Array.from(years).sort((a, b) => b - a); // 降序排列
    }
```

- [ ] **Step 5: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 6: Commit**

```bash
git add src/db/local_db.ts
git commit -m "feat(db): implement monthly/yearly stats queries in LocalDb"
```

---

## Task 4: 更新 WebDb stub 方法

**Files:**
- Modify: `src/db/web_db.ts`

**背景:** WebDb 是远程服务器模式，暂不支持新的统计查询，返回空数据并记录警告。

- [ ] **Step 1: 导入新类型**

```typescript
import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapStats,
    MonthlyStats, YearlyStats  // 新增
} from "./interface";
```

- [ ] **Step 2: 添加 stub 方法**

在 getExpressionsByDateRange 方法之后添加：

```typescript
    // 获取指定年份的月度统计（stub 实现）
    async getMonthlyStats(year: number): Promise<MonthlyStats[]> {
        console.warn("[WebDb] getMonthlyStats not implemented");
        return [];
    }

    // 获取多个年份的年度统计（stub 实现）
    async getYearlyStats(years: number[]): Promise<YearlyStats[]> {
        console.warn("[WebDb] getYearlyStats not implemented");
        return [];
    }

    // 获取数据库中有数据的年份列表（stub 实现）
    async getAvailableYears(): Promise<number[]> {
        console.warn("[WebDb] getAvailableYears not implemented");
        return [];
    }
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 4: Commit**

```bash
git add src/db/web_db.ts
git commit -m "feat(db): add stub methods for monthly/yearly stats in WebDb"
```

---

## Task 5: 更新 JsonSyncDb 委托方法

**Files:**
- Modify: `src/db/json_sync_db.ts`

**背景:** JsonSyncDb 将查询委托给底层的 LocalDb 实例。

- [ ] **Step 1: 导入新类型**

修改导入语句：

```typescript
import type {
    ArticleWords, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount,
    HeatmapStats,
    MonthlyStats, YearlyStats  // 新增
} from "./interface";
```

- [ ] **Step 2: 添加委托方法**

在 getExpressionsByDateRange 方法之后添加：

```typescript
    /**
     * 获取指定年份的月度统计
     */
    async getMonthlyStats(year: number): Promise<MonthlyStats[]> {
        return this.localDb.getMonthlyStats(year);
    }

    /**
     * 获取多个年份的年度统计
     */
    async getYearlyStats(years: number[]): Promise<YearlyStats[]> {
        return this.localDb.getYearlyStats(years);
    }

    /**
     * 获取数据库中有数据的年份列表
     */
    async getAvailableYears(): Promise<number[]> {
        return this.localDb.getAvailableYears();
    }
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 4: Commit**

```bash
git add src/db/json_sync_db.ts
git commit -m "feat(db): delegate monthly/yearly stats to localDb in JsonSyncDb"
```

---

## Task 6: 创建 MonthGrid.vue 组件

**Files:**
- Create: `src/views/MonthGrid.vue`

**背景:** 月份网格组件显示12个月份的卡片（3行×4列布局），每个卡片显示该月的总学习单词数。

- [ ] **Step 1: 创建组件文件**

```vue
<template>
    <div class="month-grid">
        <div
            v-for="monthData in monthlyData"
            :key="monthData.month"
            class="month-card"
            :class="[
                `level-${getLevel(monthData.totalWords)}`,
                { 'current-month': isCurrentMonth(monthData) }
            ]"
            @click="selectMonth(monthData)"
        >
            <div class="month-name">{{ monthLabels[monthData.month - 1] }}</div>
            <div class="month-count">{{ monthData.totalWords }}</div>
            <div class="month-days">{{ monthData.daysWithActivity }} {{ t("days") }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { moment } from "obsidian";
import { t } from "@/lang/helper";
import type { MonthlyStats } from "@/db/interface";

// Props
const props = defineProps<{
    monthlyData: MonthlyStats[];
    currentYear: number;
}>();

// Emits
const emit = defineEmits<{
    (e: "select-month", month: number): void;
}>();

// 月份标签
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 计算强度等级 (0-4)
function getLevel(count: number): number {
    if (count === 0) return 0;
    if (count <= 10) return 1;
    if (count <= 30) return 2;
    if (count <= 60) return 3;
    return 4;
}

// 检查是否为当前月份
function isCurrentMonth(monthData: MonthlyStats): boolean {
    const now = moment();
    return monthData.year === now.year() && monthData.month === now.month() + 1;
}

// 选择月份
function selectMonth(monthData: MonthlyStats): void {
    emit("select-month", monthData.month);
}
</script>

<style scoped lang="scss">
.month-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding: 8px 0;
}

.month-card {
    padding: 16px 12px;
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--background-secondary);
    border: 2px solid transparent;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.current-month {
        border-color: var(--interactive-accent);
    }

    // 浅色主题颜色等级
    &.level-0 {
        background: var(--background-secondary);
    }
    &.level-1 {
        background: #9be9a8;
    }
    &.level-2 {
        background: #40c463;
    }
    &.level-3 {
        background: #30a14e;
    }
    &.level-4 {
        background: #216e39;

        .month-name,
        .month-count,
        .month-days {
            color: white;
        }
    }
}

.month-name {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

.month-count {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-normal);
    line-height: 1;
    margin-bottom: 4px;
}

.month-days {
    font-size: 11px;
    color: var(--text-muted);
}

// 深色主题适配
:global(.theme-dark) {
    .month-card {
        &.level-0 {
            background: #2d333b;
        }
        &.level-1 {
            background: #0e4429;
        }
        &.level-2 {
            background: #006d32;
        }
        &.level-3 {
            background: #26a641;
        }
        &.level-4 {
            background: #39d353;

            .month-name,
            .month-count,
            .month-days {
                color: rgba(0, 0, 0, 0.9);
            }
        }
    }
}

// 响应式：小屏幕改为2列
@media (max-width: 400px) {
    .month-grid {
        grid-template-columns: repeat(2, 1fr);
    }
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
git add src/views/MonthGrid.vue
git commit -m "feat(ui): add MonthGrid component for monthly statistics"
```

---

## Task 7: 创建 MultiYearView.vue 组件

**Files:**
- Create: `src/views/MultiYearView.vue`

**背景:** 多年对比视图组件垂直堆叠显示多年数据，每年一个简化版热力图。

- [ ] **Step 1: 创建组件文件**

```vue
<template>
    <div class="multi-year-view">
        <!-- 年份数量选择 -->
        <div class="year-selector-bar">
            <span class="selector-label">{{ t("Show years") }}:</span>
            <select v-model="selectedYearCount" class="year-select">
                <option :value="3">{{ t("Last 3 years") }}</option>
                <option :value="5">{{ t("Last 5 years") }}</option>
                <option :value="0">{{ t("All years") }}</option>
            </select>
        </div>

        <!-- 多年列表 -->
        <div class="years-list">
            <div
                v-for="yearStats in displayedYears"
                :key="yearStats.year"
                class="year-section"
            >
                <div class="year-header" @click="toggleYear(yearStats.year)">
                    <span class="toggle-icon">
                        {{ expandedYears.has(yearStats.year) ? "▼" : "▶" }}
                    </span>
                    <span class="year-label">{{ yearStats.year }}</span>
                    <span class="year-total">
                        {{ yearStats.totalWords }} {{ t("words") }}
                    </span>
                </div>

                <!-- 展开的详细热力图 -->
                <div v-if="expandedYears.has(yearStats.year)" class="year-detail">
                    <SimplifiedYearHeatmap
                        :year="yearStats.year"
                        :db="db"
                    />
                </div>

                <!-- 折叠时的简化条 -->
                <div v-else class="year-bar">
                    <div
                        class="activity-bar"
                        :style="{ width: getActivityPercentage(yearStats) + '%' }"
                    ></div>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-if="displayedYears.length === 0" class="empty-state">
            {{ t("No data available") }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { t } from "@/lang/helper";
import type { YearlyStats } from "@/db/interface";
import SimplifiedYearHeatmap from "./SimplifiedYearHeatmap.vue";

// Props
const props = defineProps<{
    yearlyStats: YearlyStats[];
    db: any;
}>();

// 状态
const selectedYearCount = ref(3);
const expandedYears = ref(new Set<number>());

// 计算显示的年份
const displayedYears = computed(() => {
    if (selectedYearCount.value === 0) {
        return props.yearlyStats;
    }
    return props.yearlyStats.slice(0, selectedYearCount.value);
});

// 计算活动百分比（相对于最大值的百分比）
const maxTotalWords = computed(() => {
    if (props.yearlyStats.length === 0) return 1;
    return Math.max(...props.yearlyStats.map(y => y.totalWords));
});

function getActivityPercentage(yearStats: YearlyStats): number {
    if (maxTotalWords.value === 0) return 0;
    return (yearStats.totalWords / maxTotalWords.value) * 100;
}

// 切换年份展开/折叠
function toggleYear(year: number): void {
    if (expandedYears.value.has(year)) {
        expandedYears.value.delete(year);
    } else {
        expandedYears.value.add(year);
    }
}

// 默认展开第一年
watch(() => displayedYears.value, (years) => {
    if (years.length > 0 && expandedYears.value.size === 0) {
        expandedYears.value.add(years[0].year);
    }
}, { immediate: true });
</script>

<style scoped lang="scss">
.multi-year-view {
    padding: 8px 0;
}

.year-selector-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;

    .selector-label {
        font-size: 13px;
        color: var(--text-muted);
    }

    .year-select {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        color: var(--text-normal);
        font-size: 13px;
        cursor: pointer;

        &:focus {
            outline: none;
            border-color: var(--interactive-accent);
        }
    }
}

.years-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.year-section {
    background: var(--background-secondary);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--background-modifier-border);
}

.year-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
        background: var(--background-modifier-hover);
    }

    .toggle-icon {
        font-size: 12px;
        color: var(--text-muted);
        width: 16px;
        text-align: center;
    }

    .year-label {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-normal);
        min-width: 60px;
    }

    .year-total {
        font-size: 13px;
        color: var(--text-muted);
        margin-left: auto;
    }
}

.year-bar {
    padding: 0 16px 12px;

    .activity-bar {
        height: 4px;
        background: linear-gradient(90deg, var(--interactive-accent), var(--text-accent));
        border-radius: 2px;
        transition: width 0.3s ease;
    }
}

.year-detail {
    padding: 0 16px 16px;
    border-top: 1px solid var(--background-modifier-border);
}

.empty-state {
    text-align: center;
    padding: 32px;
    color: var(--text-muted);
    font-style: italic;
}
</style>
```

- [ ] **Step 2: 创建 SimplifiedYearHeatmap.vue 子组件**

创建文件 `src/views/SimplifiedYearHeatmap.vue`：

```vue
<template>
    <div class="simplified-heatmap">
        <div v-if="loading" class="loading">{{ t("Loading...") }}</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else class="heatmap-grid">
            <div
                v-for="cell in heatmapCells"
                :key="cell.date"
                class="heatmap-cell"
                :class="`level-${cell.level}`"
                :title="getCellTitle(cell)"
            ></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { moment } from "obsidian";
import { t } from "@/lang/helper";
import type { HeatmapData } from "@/db/interface";

// Props
const props = defineProps<{
    year: number;
    db: any;
}>();

// 状态
const loading = ref(true);
const error = ref("");
const heatmapData = ref<HeatmapData[]>([]);

// 生成简化热力图格子（每月一列，每列显示该月活跃度）
const heatmapCells = computed(() => {
    const cells: HeatmapData[] = [];
    const yearData = new Map(heatmapData.value.map(d => [d.date, d]));

    // 生成每周一行，每列代表一周
    const startOfYear = moment().year(props.year).startOf("year");
    const endOfYear = moment().year(props.year).endOf("year");

    let current = startOfYear.clone().startOf("week");

    while (current.isSameOrBefore(endOfYear)) {
        const dateStr = current.format("YYYY-MM-DD");
        const data = yearData.get(dateStr);

        cells.push({
            date: dateStr,
            count: data?.count || 0,
            level: data?.level || 0
        });

        current.add(1, "day");
    }

    return cells;
});

function getCellTitle(cell: HeatmapData): string {
    const date = moment(cell.date).format("MMM D");
    return `${date}: ${cell.count} ${t("words")}`;
}

// 加载数据
async function loadData() {
    try {
        loading.value = true;
        error.value = "";
        const result = await props.db.getHeatmapData(props.year);
        heatmapData.value = result.data;
    } catch (e) {
        error.value = t("Failed to load data");
        console.error("Failed to load heatmap data:", e);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadData();
});
</script>

<style scoped lang="scss">
.simplified-heatmap {
    padding: 8px 0;
}

.loading,
.error {
    text-align: center;
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
}

.heatmap-grid {
    display: grid;
    grid-template-columns: repeat(53, 8px);
    grid-template-rows: repeat(7, 8px);
    gap: 2px;
    overflow-x: auto;
}

.heatmap-cell {
    width: 8px;
    height: 8px;
    border-radius: 1px;

    &.level-0 {
        background-color: var(--background-modifier-border);
    }
    &.level-1 {
        background-color: #9be9a8;
    }
    &.level-2 {
        background-color: #40c463;
    }
    &.level-3 {
        background-color: #30a14e;
    }
    &.level-4 {
        background-color: #216e39;
    }
}

// 深色主题适配
:global(.theme-dark) {
    .heatmap-cell {
        &.level-0 {
            background-color: #2d333b;
        }
        &.level-1 {
            background-color: #0e4429;
        }
        &.level-2 {
            background-color: #006d32;
        }
        &.level-3 {
            background-color: #26a641;
        }
        &.level-4 {
            background-color: #39d353;
        }
    }
}
</style>
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 4: Commit**

```bash
git add src/views/MultiYearView.vue src/views/SimplifiedYearHeatmap.vue
git commit -m "feat(ui): add MultiYearView and SimplifiedYearHeatmap components"
```

---

## Task 8: 修改 HeatmapPanel.vue 整合新视图

**Files:**
- Modify: `src/views/HeatmapPanel.vue`

**背景:** 在现有热力图面板中添加视图切换功能，整合月份网格和多年对比视图。

- [ ] **Step 1: 导入新组件和类型**

修改 script 部分的导入：

```typescript
import { ref, computed, onMounted, watch } from "vue";
import { moment } from "obsidian";
import { t } from "@/lang/helper";
import type { HeatmapStats, HeatmapData, ExpressionInfoSimple, MonthlyStats, YearlyStats } from "@/db/interface";
import MonthGrid from "./MonthGrid.vue";
import MultiYearView from "./MultiYearView.vue";

// 视图模式类型
type ViewMode = 'year' | 'month-grid' | 'multi-year';
```

- [ ] **Step 2: 添加新状态**

在 setup 中添加新状态：

```typescript
// 视图模式
const viewMode = ref<ViewMode>('year');

// 月份统计数据
const monthlyStats = ref<MonthlyStats[]>([]);

// 多年统计数据
const yearlyStatsList = ref<YearlyStats[]>([]);
const availableYears = ref<number[]>([]);

// 加载状态
const loadingMonthly = ref(false);
const loadingYearly = ref(false);
```

- [ ] **Step 3: 添加加载方法**

添加加载月份和年度统计的方法：

```typescript
// 加载月度统计
async function loadMonthlyStats() {
    if (!props.db) return;

    loadingMonthly.value = true;
    try {
        monthlyStats.value = await props.db.getMonthlyStats(currentYear.value);
    } catch (e) {
        console.error("Failed to load monthly stats:", e);
    } finally {
        loadingMonthly.value = false;
    }
}

// 加载年度统计
async function loadYearlyStats() {
    if (!props.db) return;

    loadingYearly.value = true;
    try {
        // 获取有数据的年份
        availableYears.value = await props.db.getAvailableYears();

        // 加载所有年份的统计
        if (availableYears.value.length > 0) {
            yearlyStatsList.value = await props.db.getYearlyStats(availableYears.value);
        }
    } catch (e) {
        console.error("Failed to load yearly stats:", e);
    } finally {
        loadingYearly.value = false;
    }
}
```

- [ ] **Step 4: 修改模板添加视图切换**

在模板中找到年份选择器的位置，添加视图切换标签：

```vue
<!-- 年份选择器 -->
<div class="year-selector">
    <button class="year-btn" @click="changeYear(-1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
        </svg>
    </button>
    <span class="year-display">{{ currentYear }}</span>
    <button class="year-btn" @click="changeYear(1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
        </svg>
    </button>
</div>

<!-- 视图切换标签 -->
<div class="view-mode-tabs">
    <button
        class="tab-btn"
        :class="{ active: viewMode === 'year' }"
        @click="switchViewMode('year')"
    >
        {{ t("Year View") }}
    </button>
    <button
        class="tab-btn"
        :class="{ active: viewMode === 'month-grid' }"
        @click="switchViewMode('month-grid')"
    >
        {{ t("Month Grid") }}
    </button>
    <button
        class="tab-btn"
        :class="{ active: viewMode === 'multi-year' }"
        @click="switchViewMode('multi-year')"
    >
        {{ t("Multi Year") }}
    </button>
</div>
```

- [ ] **Step 5: 添加条件渲染**

根据视图模式显示不同内容：

```vue
<!-- 年视图 -->
<div v-if="viewMode === 'year'" class="year-view">
    <!-- 保留现有热力图网格代码 -->
    <div class="heatmap-grid-container">
        <!-- ... 现有热力图代码 ... -->
    </div>
</div>

<!-- 月份网格视图 -->
<div v-else-if="viewMode === 'month-grid'" class="month-grid-view">
    <div v-if="loadingMonthly" class="loading">{{ t("Loading...") }}</div>
    <MonthGrid
        v-else
        :monthly-data="monthlyStats"
        :current-year="currentYear"
        @select-month="onSelectMonth"
    />
</div>

<!-- 多年对比视图 -->
<div v-else-if="viewMode === 'multi-year'" class="multi-year-view-wrapper">
    <div v-if="loadingYearly" class="loading">{{ t("Loading...") }}</div>
    <MultiYearView
        v-else
        :yearly-stats="yearlyStatsList"
        :db="props.db"
    />
</div>
```

- [ ] **Step 6: 添加切换方法**

```typescript
// 切换视图模式
function switchViewMode(mode: ViewMode) {
    viewMode.value = mode;

    // 加载对应数据
    if (mode === 'month-grid' && monthlyStats.value.length === 0) {
        loadMonthlyStats();
    } else if (mode === 'multi-year' && yearlyStatsList.value.length === 0) {
        loadYearlyStats();
    }
}

// 选择月份
function onSelectMonth(month: number) {
    // 切换回年视图并滚动到对应月份
    viewMode.value = 'year';
    // 可以添加滚动到对应月份的逻辑
}
```

- [ ] **Step 7: 添加样式**

在 style 部分添加：

```scss
// 视图切换标签
.view-mode-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    padding: 4px;
    background: var(--background-secondary);
    border-radius: 8px;

    .tab-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-size: 13px;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s ease;

        &:hover {
            color: var(--text-normal);
            background: var(--background-modifier-hover);
        }

        &.active {
            background: var(--interactive-accent);
            color: white;
            font-weight: 500;
        }
    }
}

// 加载状态
.loading {
    text-align: center;
    padding: 32px;
    color: var(--text-muted);
}

// 月份网格视图和多年视图容器
.month-grid-view,
.multi-year-view-wrapper {
    margin-top: 8px;
}
```

- [ ] **Step 8: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 9: Commit**

```bash
git add src/views/HeatmapPanel.vue
git commit -m "feat(ui): integrate month grid and multi-year views into HeatmapPanel"
```

---

## Task 9: 添加多语言翻译

**Files:**
- Modify: `src/lang/locale/zh.ts`
- Modify: `src/lang/locale/en.ts`
- Modify: `src/lang/locale/zh-TW.ts`

**背景:** 为新增界面元素添加中文、英文、繁体中文翻译。

- [ ] **Step 1: 更新 zh.ts**

在文件末尾 Heatmap Panel 部分添加：

```typescript
    // Heatmap Panel - View Modes
    "Year View": "年视图",
    "Month Grid": "月份网格",
    "Multi Year": "多年对比",
    "Show years": "显示年份",
    "Last 3 years": "最近3年",
    "Last 5 years": "最近5年",
    "All years": "全部年份",
    "days": "天",
    "No data available": "暂无数据",
    "Failed to load data": "加载数据失败",
```

- [ ] **Step 2: 更新 en.ts**

```typescript
    // Heatmap Panel - View Modes
    "Year View": "Year View",
    "Month Grid": "Month Grid",
    "Multi Year": "Multi Year",
    "Show years": "Show years",
    "Last 3 years": "Last 3 years",
    "Last 5 years": "Last 5 years",
    "All years": "All years",
    "days": "days",
    "No data available": "No data available",
    "Failed to load data": "Failed to load data",
```

- [ ] **Step 3: 更新 zh-TW.ts**

```typescript
    // Heatmap Panel - View Modes
    "Year View": "年視圖",
    "Month Grid": "月份網格",
    "Multi Year": "多年對比",
    "Show years": "顯示年份",
    "Last 3 years": "最近3年",
    "Last 5 years": "最近5年",
    "All years": "全部年份",
    "days": "天",
    "No data available": "暫無數據",
    "Failed to load data": "加載數據失敗",
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 5: Commit**

```bash
git add src/lang/locale/*.ts
git commit -m "feat(i18n): add translations for heatmap view modes"
```

---

## Task 10: 最终验证

**Files:**
- All modified files

- [ ] **Step 1: 完整构建验证**

```bash
npm run build
# Expected: 构建成功，无错误
```

- [ ] **Step 2: 检查构建产物**

```bash
ls -lh main.js main.css
# Expected: 文件存在且大小合理
```

- [ ] **Step 3: 代码检查**

```bash
# 检查是否有明显的代码问题
npm run lint 2>/dev/null || echo "No lint script, skipping"
```

- [ ] **Step 4: 最终提交**

```bash
git log --oneline -5
# 确认提交历史清晰
```

---

## 测试清单

实现完成后，手动测试以下场景：

- [ ] 打开热力图面板，切换到"月份网格"视图
- [ ] 月份网格正确显示12个月的数据
- [ ] 点击月份卡片，跳转到年视图
- [ ] 切换到"多年对比"视图
- [ ] 多年数据垂直堆叠显示
- [ ] 展开/折叠单年详情
- [ ] 切换显示最近3年/5年/全部
- [ ] 深色主题下颜色正确
- [ ] 切换年份时数据更新
- [ ] 空数据时显示友好提示

---

## 依赖总结

| 任务 | 依赖 |
|------|------|
| Task 1 | 无 |
| Task 2 | Task 1 |
| Task 3 | Task 2 |
| Task 4 | Task 2 |
| Task 5 | Task 3 |
| Task 6 | 无 |
| Task 7 | 无 |
| Task 8 | Task 6, Task 7 |
| Task 9 | 无 |
| Task 10 | 全部 |

---

**计划完成！** 准备开始执行。
