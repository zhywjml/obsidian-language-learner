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

// 生成简化热力图格子
const heatmapCells = computed(() => {
    const cells: HeatmapData[] = [];
    const yearData = new Map(heatmapData.value.map(d => [d.date, d]));

    // 获取年份的起始
    const startOfYear = moment().year(props.year).startOf("year");
    const endOfYear = moment().year(props.year).endOf("year");

    // 找到包含1月1日的那一周的第一个周日
    const dayOfWeek = startOfYear.day();
    let current = startOfYear.clone().subtract(dayOfWeek, 'days');

    // 先生成所有日期的数据
    const allDays: { date: string; count: number; level: number }[] = [];
    const iter = current.clone();
    const endIter = endOfYear.clone().add(14, 'days');

    while (iter.isBefore(endIter, 'day')) {
        const dateStr = iter.format("YYYY-MM-DD");
        const data = yearData.get(dateStr);
        const inYear = iter.year() === props.year;

        allDays.push({
            date: dateStr,
            count: inYear ? (data?.count || 0) : 0,
            level: inYear ? (data?.level || 0) : 0,
        });

        iter.add(1, 'day');
    }

    // 按列重新组织数据（每列7天）
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
    grid-auto-flow: column;  // 关键：按列填充
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
