<template>
    <div id="mdict-result">
        <div v-if="loading" class="loading">
            {{ t("Loading...") }}
        </div>
        <div v-else-if="!result.found" class="not-found">
            <p>{{ t("No result found") }}</p>
            <div v-if="suggestions.length > 0" class="suggestions">
                <p>{{ t("Did you mean:") }}</p>
                <ul>
                    <li v-for="sug in suggestions" :key="sug.keyText" @click="selectSuggestion(sug.keyText)">
                        {{ sug.keyText }}
                    </li>
                </ul>
            </div>
        </div>
        <div v-else class="result">
            <h2 class="word-title">{{ result.word }}</h2>
            <div class="definition" v-html="sanitizedDefinition"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, getCurrentInstance } from "vue";
import { sanitizeHTMLToDom } from "obsidian";
import { t } from "@/lang/helper";
import PluginType from "@/plugin";
import { MdictSearchResult, MdictSuggestion } from "./types";
import { useLoading } from "@dict/uses";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const props = defineProps<{
    word: string;
}>();

const emits = defineEmits<{
    (event: "loading", status: { id: string, loading: boolean, result: boolean }): void;
    (event: "select-word", word: string): void;
}>();

let result = ref<MdictSearchResult>({
    word: "",
    definition: null,
    found: false
});
let suggestions = ref<MdictSuggestion[]>([]);
let loading = ref(false);

/**
 * 清理和转换 HTML 定义内容
 */
const sanitizedDefinition = computed(() => {
    if (!result.value.definition) return "";

    let html = result.value.definition;

    // 处理常见的词典样式问题
    // 移除可能导致问题的脚本和样式标签
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    // 处理图片路径（MDict 词典通常使用相对路径或特殊协议）
    // 将 \\ 标记转换为可点击的链接
    html = html.replace(/\\([^\\]+)\\/g, '<a href="#" class="mdict-link">$1</a>');

    return html;
});

/**
 * 执行查词
 */
async function onSearch(): Promise<boolean> {
    if (!props.word || !props.word.trim()) {
        return false;
    }

    const engine = plugin.mdictEngine;
    if (!engine || !engine.isLoaded()) {
        return false;
    }

    loading.value = true;

    try {
        // 查询单词
        const searchResult = engine.search(props.word.trim());
        result.value = searchResult;

        // 如果没找到，尝试获取建议
        if (!searchResult.found) {
            suggestions.value = engine.suggest(props.word.trim(), 8, 3);
        } else {
            suggestions.value = [];
        }

        loading.value = false;
        return searchResult.found;
    } catch (error) {
        console.error("MDict search error:", error);
        loading.value = false;
        return false;
    }
}

/**
 * 选择建议词
 */
function selectSuggestion(word: string) {
    emits("select-word", word);
}

useLoading(() => props.word, "mdict", onSearch, emits);
</script>

<style lang="scss">
#mdict-result {
    padding: 10px;
    font-size: 0.9em;

    .loading {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
    }

    .not-found {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);

        .suggestions {
            margin-top: 15px;
            text-align: left;

            ul {
                list-style: none;
                padding: 0;

                li {
                    padding: 5px 10px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background-color 0.2s;

                    &:hover {
                        background-color: var(--background-modifier-hover);
                    }
                }
            }
        }
    }

    .result {
        .word-title {
            font-size: 1.4em;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--text-normal);
        }

        .definition {
            line-height: 1.6;

            // 词典常见样式
            .phonetic, .pron {
                color: var(--text-accent);
                font-style: italic;
            }

            .pos {
                color: var(--text-accent);
                font-weight: bold;
                margin-right: 5px;
            }

            .definition-item {
                margin: 8px 0;
                padding-left: 15px;
                position: relative;

                &:before {
                    content: "•";
                    position: absolute;
                    left: 0;
                    color: var(--text-muted);
                }
            }

            .example {
                font-style: italic;
                color: var(--text-muted);
                margin: 5px 0 5px 15px;
            }

            .mdict-link {
                color: var(--text-accent);
                cursor: pointer;
                text-decoration: underline;

                &:hover {
                    color: var(--text-accent-hover);
                }
            }

            // 处理表格
            table {
                border-collapse: collapse;
                width: 100%;
                margin: 10px 0;

                td, th {
                    border: 1px solid var(--background-modifier-border);
                    padding: 5px 10px;
                }

                th {
                    background-color: var(--background-modifier-hover);
                }
            }

            // 处理图片
            img {
                max-width: 100%;
                height: auto;
            }

            // 处理音频链接
            a[href^="sound://"], a[href*=".mp3"], a[href*=".wav"] {
                &:before {
                    content: "🔊";
                    margin-right: 5px;
                }
            }
        }
    }
}

.theme-dark #mdict-result {
    .result .definition {
        .phonetic, .pron {
            color: #7aa2f7;
        }

        .pos {
            color: #bb9af7;
        }
    }
}
</style>