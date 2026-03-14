<template>
    <div class="simple-pagination">
        <div class="pagination-controls">
            <!-- 上一页 -->
            <button
                class="page-btn nav-btn"
                :disabled="currentPage === 1"
                @click="goToPage(currentPage - 1)"
            >‹</button>

            <!-- 页码 -->
            <div class="page-numbers">
                <template v-for="(item, index) in visiblePages" :key="index">
                    <span v-if="item.type === 'ellipsis'" class="page-ellipsis">...</span>
                    <button
                        v-else
                        class="page-btn"
                        :class="{ active: item.page === currentPage }"
                        @click="item.page && goToPage(item.page)"
                    >{{ item.page }}</button>
                </template>
            </div>

            <!-- 下一页 -->
            <button
                class="page-btn nav-btn"
                :disabled="currentPage === totalPages"
                @click="goToPage(currentPage + 1)"
            >›</button>
        </div>

        <!-- 每页行数选择 -->
        <div class="page-size-control">
            <div
                class="size-dropdown"
                @mouseenter="showDropdown = true"
                @mouseleave="showDropdown = false"
            >
                <span class="size-label">{{ currentLabel }}</span>
                <!-- 菜单放在触发元素内部，这样鼠标可以移动到菜单上 -->
                <div class="dropdown-menu" v-show="showDropdown">
                    <div
                        v-for="ps in pageSizeOptions"
                        :key="ps.value"
                        class="dropdown-item"
                        :class="{ active: pageSize === ps.value }"
                        @click="selectSize(ps.value)"
                    >{{ ps.label }}</div>
                    <div class="dropdown-divider"></div>
                    <div
                        class="dropdown-item"
                        :class="{ active: isAllPages }"
                        @click="selectAll"
                    >{{ allLabel }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
    page: number;
    total: number;
    pageSize: number;
}

interface Emits {
    (e: 'update:page', page: number): void;
    (e: 'update:pageSize', size: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const currentPage = computed(() => props.page);
const showDropdown = ref(false);

// 下拉选项（不含"全部"）
const pageSizeOptions = [
    { label: '1 段/页', value: 2 },
    { label: '2 段/页', value: 4 },
    { label: '4 段/页', value: 8 },
    { label: '8 段/页', value: 16 },
    { label: '16 段/页', value: 32 },
];

const ALL_VALUE = Number.MAX_VALUE;
const allLabel = '全部';

const isAllPages = computed(() => props.pageSize === ALL_VALUE);

// 当前显示的标签
const currentLabel = computed(() => {
    if (isAllPages.value) return allLabel;
    const opt = pageSizeOptions.find(o => o.value === props.pageSize);
    return opt ? opt.label : pageSizeOptions[2].label;
});

const totalPages = computed(() => {
    if (props.pageSize === ALL_VALUE) return 1;
    return Math.max(1, Math.ceil(props.total / props.pageSize));
});

const selectSize = (value: number) => {
    emit('update:pageSize', value);
    showDropdown.value = false;
};

const selectAll = () => {
    emit('update:pageSize', ALL_VALUE);
    showDropdown.value = false;
};

// 计算可见页码（最多显示7个）
const visiblePages = computed(() => {
    const current = currentPage.value;
    const total = totalPages.value;

    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => ({
            type: 'page' as const,
            page: i + 1
        }));
    }

    const pages: Array<{ type: 'page' | 'ellipsis'; page?: number }> = [];

    if (current <= 4) {
        for (let i = 1; i <= 5; i++) {
            pages.push({ type: 'page', page: i });
        }
        pages.push({ type: 'ellipsis' });
        pages.push({ type: 'page', page: total });
    } else if (current >= total - 3) {
        pages.push({ type: 'page', page: 1 });
        pages.push({ type: 'ellipsis' });
        for (let i = total - 4; i <= total; i++) {
            pages.push({ type: 'page', page: i });
        }
    } else {
        pages.push({ type: 'page', page: 1 });
        pages.push({ type: 'ellipsis' });
        for (let i = current - 1; i <= current + 1; i++) {
            pages.push({ type: 'page', page: i });
        }
        pages.push({ type: 'ellipsis' });
        pages.push({ type: 'page', page: total });
    }

    return pages;
});

const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
        emit('update:page', page);
    }
};
</script>

<style lang="scss" scoped>
.simple-pagination {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;

    .pagination-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .page-numbers {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .page-btn {
        min-width: 32px;
        height: 32px;
        padding: 0 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(:disabled) {
            background: var(--background-secondary);
            border-color: var(--interactive-accent);
        }

        &.active {
            background: var(--interactive-accent);
            border-color: var(--interactive-accent);
            color: var(--text-on-accent);
            font-weight: 600;
        }

        &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        &.nav-btn {
            font-size: 18px;
            font-weight: bold;
        }
    }

    .page-ellipsis {
        min-width: 32px;
        text-align: center;
        color: var(--text-muted);
        user-select: none;
    }

    .page-size-control {
        display: flex;
        align-items: center;

        .size-dropdown {
            position: relative;
            padding: 4px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            background: var(--background-primary);
            cursor: pointer;

            &:hover {
                border-color: var(--interactive-accent);
            }

            .size-label {
                font-size: 12px;
                color: var(--text-normal);
            }

            .dropdown-menu {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                padding: 4px 0;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                z-index: 100;
                min-width: 100px;

                .dropdown-item {
                    padding: 6px 12px;
                    font-size: 12px;
                    color: var(--text-normal);
                    cursor: pointer;
                    white-space: nowrap;

                    &:hover {
                        background: var(--background-secondary);
                    }

                    &.active {
                        color: var(--interactive-accent);
                        font-weight: 600;
                    }
                }

                .dropdown-divider {
                    height: 1px;
                    background: var(--background-modifier-border);
                    margin: 4px 0;
                }
            }
        }
    }
}
</style>