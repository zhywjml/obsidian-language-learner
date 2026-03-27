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
const monthLabels = computed(() => [
    t("Jan"), t("Feb"), t("Mar"), t("Apr"),
    t("May"), t("Jun"), t("Jul"), t("Aug"),
    t("Sep"), t("Oct"), t("Nov"), t("Dec")
]);

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
