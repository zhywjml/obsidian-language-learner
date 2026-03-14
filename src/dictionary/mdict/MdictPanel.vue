<template>
    <div id="mdict-panel">
        <div class="mdict-header">
            <div class="search-box">
                <input
                    type="text"
                    v-model="searchWord"
                    :placeholder="t('Search word...')"
                    @keydown.enter="handleSearch"
                    ref="searchInput"
                />
                <button @click="handleSearch">{{ t("Search") }}</button>
            </div>

            <div class="dict-selector" v-if="dictPaths.length > 0">
                <select v-model="selectedDict" @change="switchDictionary">
                    <option v-for="dict in dictPaths" :key="dict.path" :value="dict.path">
                        {{ getDictName(dict.path) }}
                    </option>
                </select>
            </div>
            <div class="dict-status" v-else>
                <span class="no-dict">{{ t("No dictionary loaded") }}</span>
                <button @click="openSettings">{{ t("Settings") }}</button>
            </div>
        </div>

        <div class="mdict-content">
            <MdictView
                v-if="engine?.isLoaded()"
                :word="currentWord"
                @select-word="handleSelectWord"
            />
            <div v-else class="no-dict-message">
                <p>{{ t("No dictionary loaded") }}</p>
                <p>{{ t("Please add MDX dictionary in settings") }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, getCurrentInstance, watch } from "vue";
import { Notice, TFile } from "obsidian";
import { t } from "@/lang/helper";
import PluginType from "@/plugin";
import MdictView from "./View.vue";
import { MdictEngine } from "./engine";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const searchWord = ref("");
const currentWord = ref("");
const selectedDict = ref("");
const searchInput = ref<HTMLInputElement | null>(null);

// 获取词典引擎
const engine = computed(() => plugin.mdictEngine as MdictEngine | null);

// 获取配置的词典路径列表
const dictPaths = computed(() => {
    return plugin.settings.mdict_paths || [];
});

// 从路径获取词典名称
function getDictName(path: string): string {
    const fileName = path.split("/").pop() || path;
    return fileName.replace(/\.mdx$/i, "");
}

// 执行搜索
function handleSearch() {
    if (!searchWord.value.trim()) return;
    currentWord.value = searchWord.value.trim();
}

// 选择建议词
function handleSelectWord(word: string) {
    searchWord.value = word;
    currentWord.value = word;
}

// 切换词典
async function switchDictionary() {
    if (!selectedDict.value) return;

    const success = await engine.value?.loadDictionary(selectedDict.value);
    if (success) {
        new Notice(t("Dictionary loaded"));
        // 如果已有搜索词，重新搜索
        if (currentWord.value) {
            // 触发重新搜索
            const temp = currentWord.value;
            currentWord.value = "";
            setTimeout(() => {
                currentWord.value = temp;
            }, 0);
        }
    }
}

// 打开设置
function openSettings() {
    (plugin as any).app.setting.open();
    (plugin as any).app.setting.openTabById("language-learner");
}

// 初始化
onMounted(async () => {
    // 如果有配置的词典，加载第一个
    const paths = dictPaths.value;
    if (paths.length > 0) {
        const firstDict = paths.find(d => d.enabled);
        if (firstDict) {
            selectedDict.value = firstDict.path;
            await engine.value?.loadDictionary(firstDict.path);
        }
    }

    // 聚焦搜索框
    searchInput.value?.focus();
});

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
</script>

<style lang="scss">
#mdict-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    font-size: 0.85em;

    .mdict-header {
        padding: 10px;
        border-bottom: 1px solid var(--background-modifier-border);

        .search-box {
            display: flex;
            gap: 5px;
            margin-bottom: 10px;

            input {
                flex: 1;
                padding: 5px 10px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                background: var(--background-primary);
                color: var(--text-normal);

                &:focus {
                    outline: none;
                    border-color: var(--interactive-accent);
                }
            }

            button {
                padding: 5px 15px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 4px;
                cursor: pointer;

                &:hover {
                    background: var(--interactive-accent-hover);
                }
            }
        }

        .dict-selector {
            select {
                width: 100%;
                padding: 5px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                background: var(--background-primary);
                color: var(--text-normal);
            }
        }

        .dict-status {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .no-dict {
                color: var(--text-muted);
                font-style: italic;
            }

            button {
                padding: 3px 10px;
                font-size: 0.9em;
                background: var(--background-modifier-hover);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                color: var(--text-normal);
                cursor: pointer;

                &:hover {
                    background: var(--interactive-accent);
                    color: var(--text-on-accent);
                }
            }
        }
    }

    .mdict-content {
        flex: 1;
        overflow: auto;

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
}
</style>