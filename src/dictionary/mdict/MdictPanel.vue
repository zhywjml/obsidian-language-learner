<template>
    <div id="mdict-panel" @click="handleClick">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig">
            <!-- 搜索栏 -->
            <div class="search-bar" style="display:flex;">
                <NButtonGroup size="tiny">
                    <NButton :disabled="historyIndex <= 0" @click="switchHistory('prev')">{{ `<` }}</NButton>
                    <NButton :disabled="historyIndex >= lastHistory" @click="switchHistory('next')">{{ `>` }}</NButton>
                </NButtonGroup>
                <NInput size="tiny" type="text" :placeholder="t('Search word...')" v-model:value="searchWord" style="flex:1;"
                    @keydown.enter="handleSearch" />
                <NButton size="tiny" @click="handleSearch" style="margin-left:5px;">{{ t("Search") }}</NButton>
            </div>

            <!-- 词典选择器 -->
            <div class="dict-selector" v-if="dictPaths.length > 0">
                <div
                    class="dict-dropdown"
                    @mouseenter="showDropdown = true"
                    @mouseleave="showDropdown = false"
                >
                    <span class="dict-label">{{ currentDictName }}</span>
                    <div class="dropdown-menu" v-show="showDropdown">
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
                <NButton size="tiny" @click="openSettings">{{ t("Settings") }}</NButton>
            </div>
        </NConfigProvider>

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
import { NConfigProvider, NButton, NButtonGroup, NInput, darkTheme, GlobalThemeOverrides } from "naive-ui";
import { t } from "@/lang/helper";
import PluginType from "@/plugin";
import MdictView from "./View.vue";
import { MdictEngine } from "./engine";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

// Naive UI 主题配置
const theme = computed(() => {
    return plugin.store.dark ? darkTheme : null;
});

const themeConfig: GlobalThemeOverrides = {};

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
        margin-bottom: 5px;

        button {
            margin-right: 5px;
        }
    }

    .dict-selector {
        margin-bottom: 5px;

        .dict-dropdown {
            position: relative;
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
                right: 0;
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
                    white-space: nowrap;

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