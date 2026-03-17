<template>
    <div id="langr-data">
        <div class="toolbar">
            <div class="search-row">
                <span class="search-label">Search:</span>
                <input type="text" class="search-input" v-model="searchText" />
            </div>
            <div class="tags-row">
                <span class="tags-label">Tags:</span>
                <div class="tags-dropdown" @mouseenter="showDropdown = true" @mouseleave="showDropdown = false">
                    <span class="tags-trigger">
                        <span v-if="selectedTags.length === 0">{{ t("All") }}</span>
                        <span v-else>{{ selectedTags.length }} {{ t("selected") }}</span>
                    </span>
                    <div class="dropdown-menu" v-show="showDropdown" @mouseenter="showDropdown = true" @mouseleave="showDropdown = false">
                        <div class="dropdown-header">
                            <span class="dropdown-title">{{ t("Filter by tags") }}</span>
                            <span class="dropdown-hint">{{ t("Select multiple to filter") }}</span>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-section">
                            <div
                                v-for="tag in tags"
                                :key="tag"
                                class="dropdown-item checkbox-item"
                                :class="{ checked: selectedTags.includes(tag) }"
                                @click="toggleTag(tag)"
                            >
                                <span class="checkbox">
                                    <span v-if="selectedTags.includes(tag)">✓</span>
                                </span>
                                <span class="tag-text">{{ tag }}</span>
                            </div>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-section">
                            <div class="dropdown-item create-tag" @click="showCreateTag = true">
                                <span class="plus-icon">+</span>
                                <span>{{ t("Create new tag") }}</span>
                            </div>
                            <div v-if="showCreateTag" class="create-tag-form">
                                <input
                                    type="text"
                                    v-model="newTagName"
                                    :placeholder="t('Tag name')"
                                    class="tag-input"
                                    @keydown.enter="createTag"
                                />
                                <button class="create-btn" @click="createTag">{{ t("Add") }}</button>
                            </div>
                        </div>
                    </div>
                </div>
                <select v-model="mode" class="mode-select">
                    <option value="and">And</option>
                    <option value="or">Or</option>
                </select>
            </div>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th class="expand-col"></th>
                        <th class="sortable" @click="sortBy('expr')">Expr</th>
                        <th class="sortable" @click="sortBy('status')">Status</th>
                        <th>Meaning</th>
                        <th>Tags</th>
                        <th class="sortable" @click="sortBy('date')">Date</th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="row in paginatedData" :key="row.expr">
                        <tr @click="toggleRow(row)" class="data-row" :class="{ 'has-expand': row.noteNum + row.senNum > 0 }">
                            <td class="expand-col">
                                <span v-if="row.noteNum + row.senNum > 0" class="expand-icon" @click.stop="toggleRow(row)">
                                    {{ expandedRows.has(row.expr) ? '▼' : '▶' }}
                                </span>
                            </td>
                            <td>{{ row.expr }}</td>
                            <td>
                                <span class="status-badge" :class="getStatusClass(row.status)">
                                    {{ row.status }}
                                </span>
                            </td>
                            <td>{{ row.meaning }}</td>
                            <td>
                                <span v-for="tag in row.tags" :key="tag" class="tag">
                                    {{ tag }}
                                </span>
                            </td>
                            <td>{{ row.date }}</td>
                        </tr>
                        <tr v-if="expandedRows.has(row.expr) && row.noteNum + row.senNum > 0" class="expand-row">
                            <td colspan="6">
                                <Suspense>
                                    <WordMore :word="row.expr" />
                                </Suspense>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
            <div v-if="paginatedData.length === 0" class="no-data">
                No data found
            </div>
        </div>
        <div class="pagination">
            <button :disabled="currentPage <= 1" @click="currentPage--">Previous</button>
            <span>Page {{ currentPage }} of {{ totalPages }}</span>
            <button :disabled="currentPage >= totalPages" @click="currentPage++">Next</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { moment } from "obsidian";
import {
    h,
    ref,
    computed,
    watch,
    watchEffect,
    getCurrentInstance,
    Suspense,
    defineAsyncComponent,
} from "vue";
import { t } from "@/lang/helper";

import type PluginType from "@/plugin";

const WordMore = defineAsyncComponent(() => import("@comp/WordMore.vue"));

const plugin = getCurrentInstance().appContext.config.globalProperties
    .plugin as PluginType;


interface Row {
    expr: string;
    status: string;
    meaning: string;
    tags: string[];
    date: string;
    senNum: number;
    noteNum: number;
}

const statusMap = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned"),
];


let data = ref<Row[]>([]);
let loading = ref(true);
let expandedRows = ref<Set<string>>(new Set());
let sortKey = ref<string>("date");
let sortOrder = ref<'asc' | 'desc'>('desc');

watchEffect(async () => {
    let rawData = await plugin.db.getAllExpressionSimple(false);
    data.value = rawData.map((entry, i): Row => {
        return {
            expr: entry.expression,
            status: statusMap[entry.status],
            meaning: entry.meaning,
            tags: entry.tags,
            noteNum: entry.note_num,
            senNum: entry.sen_num,
            date: moment.unix(entry.date).format("YYYY-MM-DD"),
        };
    });
    tags.value = await plugin.db.getTags();
    loading.value = false;
});

let mode = ref("and");
let tags = ref<string[]>([]);
let selectedTags = ref<string[]>([]);
let showDropdown = ref(false);
let showCreateTag = ref(false);
let newTagName = ref("");

// 切换标签选中状态
function toggleTag(tag: string) {
    const index = selectedTags.value.indexOf(tag);
    if (index === -1) {
        selectedTags.value.push(tag);
    } else {
        selectedTags.value.splice(index, 1);
    }
}

// 创建新标签
function createTag() {
    const name = newTagName.value.trim();
    if (name && !tags.value.includes(name)) {
        tags.value.push(name);
        selectedTags.value.push(name);
    }
    newTagName.value = "";
    showCreateTag.value = false;
}

// 搜索框
let searchText = ref("");

// 排序
function sortBy(key: string) {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
    }
}

// 展开行
function toggleRow(row: Row) {
    if (expandedRows.value.has(row.expr)) {
        expandedRows.value.delete(row.expr);
    } else {
        expandedRows.value.add(row.expr);
    }
    expandedRows.value = new Set(expandedRows.value);
}

// 过滤和排序数据
const filteredData = computed(() => {
    let result = data.value;

    // 按搜索文本过滤
    if (searchText.value) {
        result = result.filter(row =>
            row.expr.toLowerCase().includes(searchText.value.toLowerCase())
        );
    }

    // 按标签过滤
    if (selectedTags.value.length > 0) {
        result = result.filter(row => {
            if (mode.value === "and") {
                return selectedTags.value.every(tag => row.tags.includes(tag));
            } else {
                return selectedTags.value.some(tag => row.tags.includes(tag));
            }
        });
    }

    // 排序
    result = [...result].sort((a, b) => {
        let aVal: any = a[sortKey.value as keyof Row];
        let bVal: any = b[sortKey.value as keyof Row];

        if (sortKey.value === 'date') {
            aVal = moment(aVal).unix();
            bVal = moment(bVal).unix();
        } else if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
});

// 分页
const pageSize = 10;
const currentPage = ref(1);
const totalPages = computed(() => Math.ceil(filteredData.value.length / pageSize) || 1);

// 分页后的数据
const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    const end = start + pageSize;
    return filteredData.value.slice(start, end);
});

// 获取状态样式类
function getStatusClass(status: string) {
    const statusLower = status.toLowerCase();
    if (statusLower === t("Learning").toLowerCase()) return 'status-learning';
    if (statusLower === t("Familiar").toLowerCase()) return 'status-familiar';
    if (statusLower === t("Known").toLowerCase()) return 'status-known';
    if (statusLower === t("Learned").toLowerCase()) return 'status-learned';
    return '';
}

watch([searchText, selectedTags, sortKey, sortOrder], () => {
    currentPage.value = 1;
});


</script>

<style lang="scss">
#langr-data {
    .toolbar {
        padding: 8px;
        background: var(--background-secondary);
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .search-row {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
    }

    .search-label {
        display: inline-block;
        width: 70px;
        font-size: 1.2em;
        font-weight: bold;
        margin-right: 15px;
        color: var(--text-normal);
    }

    .search-input {
        flex: 1;
        padding: 4px 8px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        color: var(--text-normal);
        font-size: 12px;

        &:focus {
            outline: none;
            border-color: var(--interactive-accent);
        }
    }

    .tags-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .tags-label {
        display: inline-block;
        width: 70px;
        font-size: 1.2em;
        font-weight: bold;
        margin-right: 5px;
        color: var(--text-normal);
    }

    .tags-dropdown {
        position: relative;
        padding: 4px 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        cursor: pointer;
        min-width: 100px;

        &:hover {
            border-color: var(--interactive-accent);
        }

        .tags-trigger {
            font-size: 11px;
            color: var(--text-normal);
        }

        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            min-width: 180px;
            max-height: 300px;
            overflow-y: auto;
            padding: 4px 0;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 100;
            margin-top: 2px;

            .dropdown-header {
                padding: 8px 12px 4px;

                .dropdown-title {
                    display: block;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-normal);
                }

                .dropdown-hint {
                    display: block;
                    font-size: 10px;
                    color: var(--text-muted);
                    margin-top: 2px;
                }
            }

            .dropdown-divider {
                height: 1px;
                background: var(--background-modifier-border);
                margin: 4px 0;
            }

            .dropdown-section {
                max-height: 180px;
                overflow-y: auto;
            }

            .dropdown-item {
                padding: 6px 12px;
                font-size: 12px;
                color: var(--text-normal);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;

                &:hover {
                    background: var(--background-secondary);
                }

                &.checkbox-item {
                    .checkbox {
                        width: 16px;
                        height: 16px;
                        border: 1px solid var(--background-modifier-border);
                        border-radius: 3px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        color: var(--interactive-accent);
                        background: var(--background-primary);
                    }

                    &.checked .checkbox {
                        background: var(--interactive-accent);
                        border-color: var(--interactive-accent);
                        color: var(--text-on-accent);
                    }

                    .tag-text {
                        flex: 1;
                    }
                }

                &.create-tag {
                    color: var(--interactive-accent);

                    .plus-icon {
                        width: 16px;
                        height: 16px;
                        border: 1px dashed var(--interactive-accent);
                        border-radius: 3px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: bold;
                    }

                    &:hover {
                        background: var(--background-secondary);
                    }
                }
            }

            .create-tag-form {
                padding: 8px 12px;
                display: flex;
                gap: 8px;

                .tag-input {
                    flex: 1;
                    padding: 4px 8px;
                    background: var(--background-secondary);
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 4px;
                    color: var(--text-normal);
                    font-size: 11px;

                    &:focus {
                        outline: none;
                        border-color: var(--interactive-accent);
                    }
                }

                .create-btn {
                    padding: 4px 10px;
                    background: var(--interactive-accent);
                    border: none;
                    border-radius: 4px;
                    color: var(--text-on-accent);
                    font-size: 11px;
                    cursor: pointer;

                    &:hover {
                        opacity: 0.9;
                    }
                }
            }
        }
    }

    .mode-select {
        padding: 2px 6px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        color: var(--text-normal);
        font-size: 11px;
    }

    .tag-list {
        display: none;
    }

    .table-container {
        overflow: auto;
        max-height: calc(100vh - 200px);
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;

        th, td {
            padding: 6px 8px;
            text-align: left;
            border-bottom: 1px solid var(--background-modifier-border);
        }

        th {
            background: var(--background-secondary);
            color: var(--text-normal);
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 1;

            &.sortable {
                cursor: pointer;
                white-space: nowrap;

                &:hover {
                    background: var(--background-secondary-alt);
                }
            }
        }

        td {
            color: var(--text-normal);
        }

        .expand-col {
            width: 24px;
            text-align: center;
        }

        .expand-icon {
            cursor: pointer;
            font-size: 10px;
            color: var(--text-muted);
            user-select: none;
            display: inline-block;
            width: 16px;
            text-align: center;
        }

        .data-row {
            cursor: pointer;

            &:hover {
                background: var(--background-secondary);
            }
        }

        .expand-row td {
            padding: 0;
            background: var(--background-secondary);
        }

        .status-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;

            &.status-learning {
                background: #ff980055;
            }

            &.status-familiar {
                background: #ffeb3c55;
            }

            &.status-known {
                background: #9eda5855;
            }

            &.status-learned {
                background: #4cb05155;
            }
        }

        .tag {
            display: inline-block;
            padding: 1px 4px;
            margin-right: 4px;
            background: var(--background-secondary);
            border-radius: 3px;
            font-size: 10px;
            color: var(--text-muted);
        }
    }

    .no-data {
        padding: 20px;
        text-align: center;
        color: var(--text-muted);
    }

    .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-top: 1px solid var(--background-modifier-border);

        button {
            padding: 4px 12px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            cursor: pointer;
            font-size: 11px;

            &:hover:not(:disabled) {
                background: var(--background-secondary-alt);
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }

        span {
            color: var(--text-muted);
            font-size: 11px;
        }
    }

    .data-more {
        padding: 8px;

        h2 {
            margin: 0.5em 0;
            color: var(--text-normal);
        }

        .data-notes {
            p {
                white-space: pre-line;
                margin: 0.5em 5px;
                color: var(--text-normal);
            }
        }

        .data-sens {
            .data-sen {
                margin-bottom: 5px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 5px;
                padding: 8px;

                p {
                    &:first-child {
                        font-style: italic;
                        color: var(--text-normal);
                    }

                    margin: 0.5em 5px;
                    color: var(--text-muted);
                }
            }
        }
    }
}
</style>
