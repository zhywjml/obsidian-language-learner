<template>
    <div id="mdict-panel" @click="handleClick">
        <!-- 搜索栏 -->
        <div class="search-bar">
            <div class="nav-buttons">
                <button class="nav-btn" :disabled="historyIndex <= 0" @click="switchHistory('prev')">&lt;</button>
                <button class="nav-btn" :disabled="historyIndex >= lastHistory" @click="switchHistory('next')">&gt;</button>
            </div>
            <input
                type="text"
                class="search-input"
                :placeholder="t('Search word...')"
                v-model="searchWord"
                @keydown.enter="handleSearch"
            />
            <button class="search-btn" @click="handleSearch">{{ t("Search") }}</button>
        </div>

        <!-- 词典选择器 -->
        <div class="dict-selector" v-if="dictPaths.length > 0">
            <div
                class="dict-dropdown"
                @mouseenter="showDropdown = true"
                @mouseleave="showDropdown = false"
            >
                <span class="dict-label">{{ currentDictName }}</span>
                <div class="dropdown-menu" v-show="showDropdown" @mouseenter="showDropdown = true" @mouseleave="showDropdown = false">
                    <div
                        v-for="dict in dictPaths"
                        :key="dict.path"
                        class="dropdown-item"
                        :class="{ active: selectedDict === dict.path, disabled: !dict.enabled }"
                        @click="dict.enabled && switchDictionary(dict.path)"
                    >{{ getDictName(dict.path) }}</div>
                </div>
            </div>
        </div>
        <div class="dict-status" v-else>
            <span class="no-dict">{{ t("No dictionary loaded") }}</span>
            <button class="settings-btn" @click="openSettings">{{ t("Settings") }}</button>
        </div>

        <!-- 结果区域 -->
        <div class="result-area" style="overflow:auto;">
            <template v-if="engine?.isLoaded()">
                <div class="mdict-result-container">
                    <MdictView
                        :word="currentWord"
                        @select-word="handleSelectWord"
                    />
                </div>
            </template>
            <div v-else class="no-dict-message">
                <p>{{ t("No dictionary loaded") }}</p>
                <p>{{ t("Please add MDX dictionary in settings") }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, getCurrentInstance, watch } from "vue";
import { Notice, Platform } from "obsidian";
import { t } from "@/lang/helper";
import PluginType from "@/plugin";
import MdictView from "./View.vue";
import { MdictEngine } from "./engine";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

// 获取词典引擎
const engine = computed(() => plugin.mdictEngine as MdictEngine | null);

// 状态
const searchWord = ref("");
const currentWord = ref("");
const selectedDict = ref("");
const showDropdown = ref(false);

// 获取配置的词典路径列表
const dictPaths = computed(() => {
    return plugin.settings.mdict_paths || [];
});

// 从路径获取词典名称
function getDictName(path: string): string {
    const fileName = path.split("/").pop() || path;
    return fileName.replace(/\.mdx$/i, "");
}

// 当前词典名称
const currentDictName = computed(() => {
    if (!selectedDict.value) return t("Select dictionary");
    return getDictName(selectedDict.value);
});

// 历史记录
let history: string[] = [];
let lastHistory = ref(history.length - 1);
let historyIndex = ref(-1);

function switchHistory(direction: "prev" | "next") {
    historyIndex.value = Math.max(
        0,
        Math.min(historyIndex.value + (direction === "prev" ? -1 : 1), history.length - 1)
    );
    currentWord.value = history[historyIndex.value];
    searchWord.value = history[historyIndex.value];
}

function appendHistory() {
    if (historyIndex.value < history.length - 1) {
        history = history.slice(0, historyIndex.value + 1);
    }
    history.push(currentWord.value);
    lastHistory.value = history.length - 1;
    historyIndex.value++;
}

// 监听搜索事件
const onSearch = async (evt: CustomEvent) => {
    let text = evt.detail.selection as string;
    searchWord.value = text;
    currentWord.value = text;
    appendHistory();
};

// 执行搜索
function handleSearch() {
    if (!searchWord.value.trim()) return;
    currentWord.value = searchWord.value.trim();
    appendHistory();
}

// 选择建议词
function handleSelectWord(word: string) {
    searchWord.value = word;
    currentWord.value = word;
    appendHistory();
}

// 切换词典
async function switchDictionary(path: string) {
    if (!path || path === selectedDict.value) return;

    selectedDict.value = path;
    const success = await engine.value?.loadDictionary(path);
    if (success) {
        new Notice(t("Dictionary loaded"));
        if (currentWord.value) {
            const temp = currentWord.value;
            currentWord.value = "";
            setTimeout(() => {
                currentWord.value = temp;
            }, 0);
        }
    }
    showDropdown.value = false;
}

// 打开设置
function openSettings() {
    (plugin as any).app.setting.open();
    (plugin as any).app.setting.openTabById("language-learner");
}

// 处理点击
function handleClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;
    if (target.hasClass("mdict-link")) {
        evt.preventDefault();
        evt.stopPropagation();
        const word = target.textContent;
        if (word) {
            searchWord.value = word;
            currentWord.value = word;
            appendHistory();
        }
    }
}

// 监听词典路径变化
watch(() => plugin.settings.mdict_paths, async (newPaths) => {
    if (newPaths && newPaths.length > 0) {
        const firstEnabled = newPaths.find((d: any) => d.enabled);
        if (firstEnabled && firstEnabled.path !== selectedDict.value) {
            selectedDict.value = firstEnabled.path;
            await engine.value?.loadDictionary(firstEnabled.path);
        }
    }
}, { deep: true });

// 初始化
onMounted(async () => {
    const paths = dictPaths.value;
    if (paths.length > 0) {
        const firstDict = paths.find(d => d.enabled);
        if (firstDict) {
            selectedDict.value = firstDict.path;
            await engine.value?.loadDictionary(firstDict.path);
        }
    }

    // 监听搜索事件
    addEventListener('obsidian-mdict-search', onSearch);
});

onUnmounted(() => {
    removeEventListener('obsidian-mdict-search', onSearch);
});
</script>

<style lang="scss">
#mdict-panel {
    height: 100%;
    width: 100%;
    overflow: hidden;
    font-size: 0.8em;
    user-select: text;
    display: flex;
    flex-direction: column;

    .search-bar {
        display: flex;
        margin-bottom: 5px;

        .nav-buttons {
            display: flex;
            margin-right: 5px;
        }

        .nav-btn {
            padding: 2px 8px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            cursor: pointer;
            font-size: 12px;

            &:hover:not(:disabled) {
                background: var(--background-secondary-alt);
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            &:first-child {
                border-top-right-radius: 0;
                border-bottom-right-radius: 0;
            }

            &:last-child {
                border-top-left-radius: 0;
                border-bottom-left-radius: 0;
                border-left: none;
            }
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

        .search-btn {
            margin-left: 5px;
            padding: 4px 12px;
            background: var(--interactive-accent);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-on-accent);
            cursor: pointer;
            font-size: 12px;

            &:hover {
                opacity: 0.9;
            }
        }
    }

    .dict-selector {
        margin-bottom: 5px;

        .dict-dropdown {
            position: relative;
            min-height: 32px;
            padding: 4px 10px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background: var(--background-primary);
            cursor: pointer;
            text-align: center;
            font-size: 12px;

            &:hover {
                border-color: var(--interactive-accent);
            }

            .dict-label {
                color: var(--text-normal);
            }

            .dropdown-menu {
                position: absolute;
                top: 100%;
                left: 0;
                min-width: 200px;
                max-height: 200px;
                overflow-y: auto;
                padding: 4px 0;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                z-index: 100;
                margin-top: 2px;

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

                    &.active {
                        color: var(--interactive-accent);
                        font-weight: 600;
                    }

                    &.disabled {
                        color: var(--text-muted);
                        cursor: not-allowed;
                        opacity: 0.5;
                    }
                }
            }
        }
    }

    .dict-status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;

        .no-dict {
            color: var(--text-muted);
            font-size: 12px;
        }

        .settings-btn {
            padding: 4px 12px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            cursor: pointer;
            font-size: 12px;

            &:hover {
                background: var(--background-secondary-alt);
            }
        }
    }

    .result-area {
        flex: 1;
        overflow: auto;
    }

    .mdict-result-container {
        padding: 10px;
    }

    .no-dict-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
        text-align: center;
        padding: 20px;

        p {
            margin: 5px 0;
        }
    }
}

.is-mobile #mdict-panel {
    button:not(.fold-mask) {
        width: auto;
    }

    input[type='text'] {
        padding: 0;
    }
}
</style>