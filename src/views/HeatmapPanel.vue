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

        <!-- 热力图网格 -->
        <div class="heatmap-grid-container">
            <div class="heatmap-grid">
                <!-- 月份标签 -->
                <div class="month-labels">
                    <span v-for="month in monthLabels" :key="month" class="month-label">{{ month }}</span>
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
import type { HeatmapStats, HeatmapData, ExpressionInfoSimple } from "@/db/interface";

// Props
const props = defineProps<{
    db: any; // Database instance
}>();

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

// 月份标签
const monthLabels = computed(() => {
    const months = [];
    const start = moment().year(currentYear.value).startOf("year");
    for (let i = 0; i < 12; i++) {
        months.push(start.clone().add(i, "months").format("MMM"));
    }
    return months;
});

// 星期标签（周一到周日）
const weekdayLabels = computed(() => {
    return ["Mon", "", "Wed", "", "Fri", "", "Sun"];
});

// 生成热力图格子数据
const heatmapCells = computed(() => {
    const cells: HeatmapData[] = [];
    const year = currentYear.value;

    // 获取年份的起始和结束日期
    const startOfYear = moment().year(year).startOf("year");
    const endOfYear = moment().year(year).endOf("year");

    // 找到第一个周一（或周日）
    // GitHub 风格：从周一开始
    let current = startOfYear.clone().startOf("week").add(1, "day"); // 周一
    if (current.year() < year) {
        current = startOfYear.clone();
    }

    // 填充到 53 周 * 7 天 = 371 个格子
    const totalCells = 53 * 7;
    const yearData = new Map(stats.value.data.map(d => [d.date, d]));

    for (let i = 0; i < totalCells; i++) {
        const dateStr = current.format("YYYY-MM-DD");
        const data = yearData.get(dateStr);

        if (current.year() === year) {
            cells.push({
                date: dateStr,
                count: data?.count || 0,
                level: data?.level || 0,
            });
        } else {
            cells.push({
                date: dateStr,
                count: 0,
                level: -1, // 不在当前年份，不显示
            });
        }

        current.add(1, "day");
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
};

// 选择日期
const selectDate = async (cell: HeatmapData) => {
    if (cell.level === -1) return;

    selectedDate.value = cell.date;

    try {
        // 获取该日期的所有单词
        const allWords = await props.db.getAllExpressionSimple(true);
        selectedDateWords.value = allWords.filter((word: ExpressionInfoSimple) => {
            return word.createdDate === cell.date && word.status > 0;
        });
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
    display: flex;
    justify-content: space-between;
    padding-left: 32px;
    margin-bottom: 4px;
    grid-column: 2;

    .month-label {
        font-size: 11px;
        color: var(--text-muted);
        flex: 1;
        text-align: left;
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
</style>
