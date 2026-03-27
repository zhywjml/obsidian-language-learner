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

        <!-- 年视图 -->
        <div v-if="viewMode === 'year'" class="year-view">
            <div class="heatmap-grid-container">
                <div class="heatmap-grid">
                    <!-- 月份标签 -->
                    <div class="month-labels">
                        <span
                            v-for="month in monthLabels"
                            :key="month.name + month.colIndex"
                            class="month-label"
                            :style="{ gridColumn: month.colIndex + 1 }"
                        >
                            {{ month.name }}
                        </span>
                    </div>
                    <!-- 星期标签 -->
                    <div class="weekday-labels">
                        <span v-for="day in weekdayLabels" :key="day" class="weekday-label">{{ day }}</span>
                    </div>
                    <!-- 热力图格子 -->
                    <div class="heatmap-cells">
                        <div
                            v-for="(cell, index) in heatmapCells"
                            :key="index"
                            class="heatmap-cell"
                            :class="`level-${cell.level}`"
                            :data-date="cell.date"
                            :data-count="cell.count"
                            :title="getCellTitle(cell)"
                            @click="selectDate(cell)"
                        ></div>
                    </div>
                </div>
            </div>

            <!-- 图例 -->
            <div class="heatmap-legend">
                <span class="legend-label">{{ t("Less") }}</span>
                <div class="legend-cells">
                    <div class="legend-cell level-0"></div>
                    <div class="legend-cell level-1"></div>
                    <div class="legend-cell level-2"></div>
                    <div class="legend-cell level-3"></div>
                    <div class="legend-cell level-4"></div>
                </div>
                <span class="legend-label">{{ t("More") }}</span>
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

        <!-- 选中日期的单词列表 -->
        <div v-if="selectedDate" class="word-list-section">
            <div class="word-list-header">
                <h4>{{ selectedDate }} ({{ selectedDateWords.length }} {{ t("words") }})</h4>
                <button class="close-btn" @click="selectedDate = null">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div v-if="selectedDateWords.length > 0" class="word-list">
                <div
                    v-for="word in selectedDateWords"
                    :key="word.expression"
                    class="word-item"
                    @click="openWord(word.expression)"
                >
                    <span class="word-expression">{{ word.expression }}</span>
                    <span class="word-meaning">{{ word.meaning }}</span>
                    <span class="word-status" :class="`status-${word.status}`">{{ getStatusLabel(word.status) }}</span>
                </div>
            </div>
            <div v-else class="word-list-empty">
                {{ t("No words learned on this day") }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { moment } from "obsidian";
import { t } from "@/lang/helper";
import type { HeatmapStats, HeatmapData, ExpressionInfoSimple, MonthlyStats, YearlyStats } from "@/db/interface";
import MonthGrid from "./MonthGrid.vue";
import MultiYearView from "./MultiYearView.vue";

// 视图模式类型
type ViewMode = 'year' | 'month-grid' | 'multi-year';

// Props
const props = defineProps<{
    db: any; // Database instance
}>();

// 视图模式
const viewMode = ref<ViewMode>('year');

// 当前年份
const currentYear = ref(moment().year());

// 热力图统计数据
const stats = ref<HeatmapStats>({
    totalDays: 0,
    totalLearned: 0,
    longestStreak: 0,
    currentStreak: 0,
    data: [],
    startDate: "",
    endDate: "",
});

// 选中的日期
const selectedDate = ref<string | null>(null);
const selectedDateWords = ref<ExpressionInfoSimple[]>([]);

// 月份统计数据
const monthlyStats = ref<MonthlyStats[]>([]);

// 多年统计数据
const yearlyStatsList = ref<YearlyStats[]>([]);
const availableYears = ref<number[]>([]);

// 加载状态
const loadingMonthly = ref(false);
const loadingYearly = ref(false);

// 月份标签 - 与热力图列对齐
const monthLabels = computed(() => {
    const labels: { name: string; colIndex: number }[] = [];
    const year = currentYear.value;
    const startOfYear = moment().year(year).startOf("year");
    const endOfYear = moment().year(year).endOf("year");

    // GitHub风格：从周一开始，第一列从1月1日那周开始
    // 找到包含1月1日的那一周的第一个周日（或周一，根据偏好）
    let current = startOfYear.clone();
    const dayOfWeek = current.day(); // 0=周日, 1=周一, ..., 6=周六

    // 找到该周的起始日（周日）
    const weekStart = current.clone().subtract(dayOfWeek, 'days');

    let currentMonth = -1;
    let colIndex = 0;

    // 遍历全年（加上一些前导和后缀天数）
    let iter = weekStart.clone();
    const endIter = endOfYear.clone().add(7, 'days');

    while (iter.isBefore(endIter, 'day')) {
        // 检查这一列是否包含该年的月份
        if (iter.year() === year || iter.clone().add(6, 'days').year() === year) {
            const colMonth = iter.month();

            // 当月份变化时，记录该月份的起始列
            if (colMonth !== currentMonth && iter.year() === year) {
                currentMonth = colMonth;
                labels.push({
                    name: iter.format("MMM"),
                    colIndex: colIndex
                });
            }

            colIndex++;
        }

        iter.add(7, 'days');
    }

    return labels;
});

// 星期标签（周日到周六，与GitHub一致）
const weekdayLabels = computed(() => {
    return ["", "Mon", "", "Wed", "", "Fri", ""];
});

// 生成热力图格子数据
const heatmapCells = computed(() => {
    const cells: HeatmapData[] = [];
    const year = currentYear.value;

    // 获取年份的起始和结束日期
    const startOfYear = moment().year(year).startOf("year");
    const endOfYear = moment().year(year).endOf("year");

    // 找到包含1月1日的那一周的第一个周日
    // GitHub风格：周日到周六，按列填充
    const dayOfWeek = startOfYear.day(); // 0=周日, 1=周一, ..., 6=周六
    let current = startOfYear.clone().subtract(dayOfWeek, 'days');

    // 填充约53周（371天）
    // 由于使用 grid-auto-flow: column，数据需要按列顺序填充
    // 但我们的数据是按天生成的，需要重新组织

    const yearData = new Map(stats.value.data.map(d => [d.date, d]));

    // 先生成所有日期的数据
    const allDays: { date: string; count: number; level: number; inYear: boolean }[] = [];
    const iter = current.clone();
    const endIter = endOfYear.clone().add(14, 'days'); // 多生成一些确保覆盖

    while (iter.isBefore(endIter, 'day')) {
        const dateStr = iter.format("YYYY-MM-DD");
        const data = yearData.get(dateStr);
        const inYear = iter.year() === year;

        allDays.push({
            date: dateStr,
            count: inYear ? (data?.count || 0) : 0,
            level: inYear ? (data?.level || 0) : -1,
            inYear
        });

        iter.add(1, 'day');
    }

    // 按列重新组织数据（每列7天，从周日到周六）
    const numCols = Math.ceil(allDays.length / 7);
    for (let col = 0; col < numCols; col++) {
        for (let row = 0; row < 7; row++) {
            const index = col * 7 + row;
            if (index < allDays.length) {
                cells.push(allDays[index]);
            }
        }
    }

    return cells;
});

// 获取格子标题
const getCellTitle = (cell: HeatmapData) => {
    if (cell.level === -1) return "";
    const count = cell.count;
    const date = moment(cell.date).format("MMM D, YYYY");
    return `${count} ${t("words")} on ${date}`;
};

// 获取状态标签
const getStatusLabel = (status: number) => {
    const labels = ["Ignore", "Learning", "Familiar", "Known", "Learned"];
    return t(labels[status] || "Unknown");
};

// 加载热力图数据
const loadHeatmapData = async () => {
    try {
        const data = await props.db.getHeatmapData(currentYear.value);
        stats.value = data;
    } catch (e) {
        console.error("Failed to load heatmap data:", e);
    }
};

// 改变年份
const changeYear = (delta: number) => {
    currentYear.value += delta;
    selectedDate.value = null;
    loadHeatmapData();
    // 如果在月份网格视图，同时刷新月份数据
    if (viewMode.value === 'month-grid') {
        loadMonthlyStats();
    }
};

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

// 选择月份
function onSelectMonth(month: number) {
    // 切换回年视图
    viewMode.value = 'year';
}

// 选择日期
const selectDate = async (cell: HeatmapData) => {
    if (cell.level === -1) return;

    selectedDate.value = cell.date;

    try {
        // 使用 getExpressionsByDate 获取该日期的所有单词
        const words = await props.db.getExpressionsByDate(cell.date);
        selectedDateWords.value = words;
    } catch (e) {
        console.error("Failed to load words for date:", e);
        selectedDateWords.value = [];
    }
};

// 打开单词详情
const openWord = (expression: string) => {
    // 触发全局事件或调用插件方法打开单词
    const event = new CustomEvent("language-learner:open-word", {
        detail: { expression }
    });
    window.dispatchEvent(event);
};

// 监听年份变化
watch(() => currentYear.value, () => {
    loadHeatmapData();
});

onMounted(() => {
    loadHeatmapData();
});
</script>

<style scoped lang="scss">
.heatmap-panel {
    padding: 20px;
    color: var(--text-normal);
    max-width: 900px;
    margin: 0 auto;
}

.heatmap-header {
    margin-bottom: 24px;

    h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
    }
}

.heatmap-stats {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
}

.stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--interactive-accent);
    }

    .stat-label {
        font-size: 12px;
        color: var(--text-muted);
    }
}

.year-selector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 20px;

    .year-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-secondary);
        color: var(--text-normal);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
            background: var(--background-modifier-hover);
            border-color: var(--interactive-accent);
        }

        svg {
            stroke: currentColor;
        }
    }

    .year-display {
        font-size: 16px;
        font-weight: 600;
        min-width: 60px;
        text-align: center;
    }
}

.heatmap-grid-container {
    overflow-x: auto;
    padding: 8px 0;
    margin-bottom: 16px;
}

.heatmap-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
    gap: 4px;
}

.month-labels {
    display: grid;
    grid-template-columns: repeat(53, 12px);
    gap: 2px;
    padding-left: 32px;
    margin-bottom: 4px;
    grid-column: 2;

    .month-label {
        font-size: 11px;
        color: var(--text-muted);
        text-align: left;
        grid-row: 1;
    }
}

.weekday-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-right: 8px;
    grid-row: 2;
    height: 112px; // 16px * 7

    .weekday-label {
        font-size: 10px;
        color: var(--text-muted);
        line-height: 16px;
        text-align: right;
    }
}

.heatmap-cells {
    display: grid;
    grid-template-columns: repeat(53, 12px);
    grid-template-rows: repeat(7, 12px);
    grid-auto-flow: column;  // 关键：按列填充而不是按行
    gap: 2px;
    grid-column: 2;
    grid-row: 2;
}

.heatmap-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        transform: scale(1.2);
        box-shadow: 0 0 0 1px var(--text-muted);
    }

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

    &[class*="level--"] {
        background-color: transparent;
        pointer-events: none;
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

.heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-bottom: 24px;

    .legend-label {
        font-size: 11px;
        color: var(--text-muted);
    }

    .legend-cells {
        display: flex;
        gap: 3px;
    }

    .legend-cell {
        width: 12px;
        height: 12px;
        border-radius: 2px;

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
}

// 深色主题下的图例
:global(.theme-dark) {
    .heatmap-legend {
        .legend-cell {
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
}

.word-list-section {
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 16px;
    background: var(--background-secondary);

    .word-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        h4 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
        }

        .close-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;

            &:hover {
                background: var(--background-modifier-hover);
                color: var(--text-normal);
            }
        }
    }
}

.word-list {
    max-height: 300px;
    overflow-y: auto;
}

.word-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
        background: var(--background-modifier-hover);
    }

    &:not(:last-child) {
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .word-expression {
        font-weight: 600;
        min-width: 120px;
        color: var(--text-normal);
    }

    .word-meaning {
        flex: 1;
        color: var(--text-muted);
        font-size: 13px;
    }

    .word-status {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 500;

        &.status-0 {
            background: var(--background-modifier-border);
            color: var(--text-muted);
        }

        &.status-1 {
            background: rgba(255, 193, 7, 0.2);
            color: #ffc107;
        }

        &.status-2 {
            background: rgba(33, 150, 243, 0.2);
            color: #2196f3;
        }

        &.status-3 {
            background: rgba(156, 39, 176, 0.2);
            color: #9c27b0;
        }

        &.status-4 {
            background: rgba(76, 175, 80, 0.2);
            color: #4caf50;
        }
    }
}

.word-list-empty {
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
    font-size: 13px;
}

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
</style>
