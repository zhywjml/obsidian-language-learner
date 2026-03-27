<template>
    <div class="multi-year-view">
        <!-- 年份数量选择 -->
        <div class="year-selector-bar">
            <span class="selector-label">{{ t("Show years") }}:</span>
            <div
                class="size-dropdown-wrapper"
                @mouseenter="showDropdown = true"
                @mouseleave="hideDropdownWithDelay"
            >
                <div class="size-dropdown">
                    <span class="size-label">{{ currentLabel }}</span>
                </div>
                <div
                    class="dropdown-menu"
                    v-show="showDropdown"
                    @mouseenter="clearHideTimeout"
                >
                    <div
                        v-for="opt in yearOptions"
                        :key="opt.value"
                        class="dropdown-item"
                        :class="{ active: selectedYearCount === opt.value }"
                        @click="selectYearCount(opt.value)"
                    >
                        {{ opt.label }}
                    </div>
                </div>
            </div>
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
import { ref, computed, watch } from "vue";
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
const showDropdown = ref(false);
const hideTimeout = ref<number | null>(null);

// 延迟关闭下拉菜单（给鼠标移动留时间）
const hideDropdownWithDelay = () => {
    hideTimeout.value = window.setTimeout(() => {
        showDropdown.value = false;
    }, 200);
};

// 清除关闭定时器
const clearHideTimeout = () => {
    if (hideTimeout.value) {
        clearTimeout(hideTimeout.value);
        hideTimeout.value = null;
    }
};

// 年份选项
const yearOptions = [
    { label: t("Last 3 years"), value: 3 },
    { label: t("Last 5 years"), value: 5 },
    { label: t("All years"), value: 0 },
];

// 当前显示的标签
const currentLabel = computed(() => {
    const opt = yearOptions.find(o => o.value === selectedYearCount.value);
    return opt ? opt.label : yearOptions[0].label;
});

// 选择年份数量
const selectYearCount = (value: number) => {
    selectedYearCount.value = value;
    clearHideTimeout();
    showDropdown.value = false;
};

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

    .size-dropdown-wrapper {
        position: relative;
        display: inline-block;
    }

    .size-dropdown {
        min-height: 28px;
        padding: 4px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        cursor: pointer;

        &:hover {
            border-color: var(--interactive-accent);
        }

        .size-label {
            font-size: 13px;
            color: var(--text-normal);
        }
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 140px;
        padding: 4px 0;
        margin-top: -2px;
        padding-top: 6px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 100;

        .dropdown-item {
            padding: 8px 12px;
            font-size: 13px;
            color: var(--text-normal);
            cursor: pointer;
            transition: background 0.15s ease;

            &:hover {
                background: var(--background-secondary);
            }

            &.active {
                color: var(--interactive-accent);
                font-weight: 600;
            }
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
