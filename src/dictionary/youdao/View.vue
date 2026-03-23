<template>
    <div id="youdao">
        <h2>{{ word }}</h2>
        <div class="pronunces">
            <span class="pron" v-for="i in prons.length" @click="playAudio(prons[i - 1].url)">{{
                prons[i - 1].phsym
            }}</span>
        </div>
        <div class="meaning" style="margin-bottom: 10px;" v-html="meaningHTML"></div>
        <div class="translation" v-html="translationHTML" />
        <button v-for="sub in ['柯林斯', '辨析', '词组', '同根词']" @click="curPanel = sub"
            :style="curPanel === sub ? 'background-color:#483699;color:white;' : ''">
            {{ sub }}
        </button>
        <Collins class="collins" v-if="curPanel === '柯林斯'" :mydata="collins" />
        <div class="discrimination" v-else-if="curPanel === '辨析'" v-html="discriminationHTML"></div>
        <div class="word-group" v-else-if="curPanel === '词组'" v-html="wordGroupHTML"></div>
        <div class="rel-word" v-else-if="curPanel === '同根词'" v-html="relWordHTML"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

import Collins from "./YDCollins.vue"
import { search, YoudaoResultLex } from "./engine"
import { useLoading } from "@dict/uses"
import { playAudio } from "@/utils/helpers"

// import Plugin from "../plugin"
// const plugin: Plugin = getCurrentInstance().appContext.config.globalProperties.plugin

const props = defineProps<{
    word: string,
}>()

const emits = defineEmits<{
    (event: "loading", status: { id: string, loading: boolean, result: boolean }): void
}>()

let word = ref("")
let meaningHTML = ref("")
let translationHTML = ref("")
let prons = ref([])
let curPanel = ref("柯林斯")
let collins = ref([{}])
let discriminationHTML = ref("")
let wordGroupHTML = ref("")
let relWordHTML = ref("")

async function onSearch(): Promise<boolean> {
    let res = await search(props.word)
    if (!res) {
        return false;
    }
    let result = res.result as YoudaoResultLex;
    word.value = result.title;
    meaningHTML.value = result.basic;
    translationHTML.value = result.translation;
    prons.value = result.prons;
    collins.value = result.collins;
    discriminationHTML.value = result.discrimination;
    wordGroupHTML.value = result.wordGroup;
    relWordHTML.value = result.relWord;

    await nextTick();
    return true;
}

useLoading(() => props.word, "youdao", onSearch, emits);

</script>

<style lang="scss">
#youdao {
    h2 {
        font-size: 1.3em;
        font-weight: 700;
        margin-bottom: 6px;
    }

    .pron {
        margin-right: 15px;
        color: deeppink;
        font-size: 1.1em;
        cursor: pointer;
        transition: opacity 0.2s;

        &:hover {
            opacity: 0.7;
        }
    }

    .meaning {
        ul {
            padding-left: 0;
        }

        // 基本释义列表项
        li {
            padding: 2px 0;
            line-height: 1.5;
        }
    }

    // Tab 按钮样式
    button {
        margin-right: 4px;
        margin-bottom: 4px;
        padding: 4px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        font-size: 0.9em;
        transition: all 0.2s;

        &:hover {
            border-color: #483699;
            color: #483699;
        }
    }

    h1,
    h2,
    h3,
    h4 {
        margin-top: 0.2em;
        margin-bottom: 0.2em;
    }

    p {
        margin-top: 0.2em;
        margin-bottom: 0.2em;
    }

    ul {
        padding-left: 20px;
        margin-top: 0.2em;
        margin-bottom: 0.2em;
    }

    ul,
    ol,
    li {
        list-style-type: none;
    }

    .collins {
        h4 {

            span,
            em {
                margin-right: 5px;
            }
        }

        .collinsMajorTrans .additional {
            color: lightsalmon;
        }

        .exampleLists {
            margin: 5px 0 5px 0px;
            padding-left: 20px;
            border-left: 1px solid #d9d9d9
        }

        .collinsOrder {
            float: left;
            margin-left: -15px;
        }
    }

    .discrimination {
        .title {
            font-size: 1.1em;
            font-weight: bold;
            margin-bottom: 8px;
            color: #333;
        }

        .wordGroup {
            margin-left: 10px;
        }

        .wt-container {
            margin-top: 0.6em;
            padding: 8px 10px;
            border-radius: 4px;
        }

        // 辨析中的词性标签
        .star {
            color: #888;
            font-size: 0.9em;
            margin-left: 6px;
        }

        // 辨析内容
        p {
            line-height: 1.6;
        }
    }

    .translation {
        margin-top: 10px;

        .wt-container {
            padding: 10px 12px;
            margin-bottom: 8px;
            border-radius: 6px;
        }

        .title {
            font-weight: bold;
            color: #483699;
            margin-bottom: 6px;
            font-size: 1em;

            .gray {
                color: #999;
                font-size: 0.85em;
                font-weight: normal;
            }
        }

        .collapse-content {
            color: #444;
            font-size: 0.95em;
            line-height: 1.6;

            &.via {
                color: #888;
                font-size: 0.85em;
                margin-top: 6px;
                padding-top: 6px;
                border-top: 1px dashed #ddd;
            }
        }

        // 网络翻译中的标题样式
        .search-word {
            font-weight: bold;
            color: #333;
        }

        // 翻译内容段落
        p {
            margin: 4px 0;
        }
    }

    .word-group {
        .wordGroup {
            padding: 8px 0;
            border-bottom: 1px dashed #ddd;

            &:last-child {
                border-bottom: none;
            }
        }

        .contentTitle {
            margin-bottom: 4px;

            a {
                color: #483699;
                font-weight: 500;
            }
        }

        // 词组释义
        .content {
            color: #444;
            font-size: 0.95em;
            line-height: 1.5;
        }
    }

    .rel-word {
        .wordGroup {
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;

            &:last-child {
                border-bottom: none;
            }
        }

        .contentTitle {
            margin-bottom: 4px;

            a {
                color: #483699;
                font-weight: 500;
            }
        }

        // 同根词词性标签
        .star {
            color: #888;
            font-size: 0.9em;
            margin-left: 8px;
        }

        // 同根词释义
        .wordGroup:hover {
            background-color: rgba(72, 54, 153, 0.03);
        }
    }
}

.theme-light #youdao {

    .collins .collinsMajorTrans,
    .discrimination .wt-container,
    .translation .wt-container {
        background-color: #c7e2ef;
    }
}

.theme-dark #youdao {

    .collins .collinsMajorTrans,
    .discrimination .wt-container,
    .translation .wt-container {
        background-color: rgba(72, 54, 153, 0.15);
    }

    // Tab 按钮深色模式
    button {
        border-color: var(--background-modifier-border);
        color: var(--text-normal);

        &:hover {
            border-color: var(--interactive-accent);
            color: var(--interactive-accent);
        }
    }

    .discrimination .title {
        color: var(--text-normal);
    }

    .translation {
        .collapse-content {
            color: var(--text-normal);
        }

        .search-word {
            color: var(--text-normal);
        }
    }

    .word-group .content {
        color: var(--text-muted);
    }

    .rel-word .wordGroup:hover {
        background-color: rgba(72, 54, 153, 0.1);
    }

    .collins .exampleLists {
        border-left-color: var(--background-modifier-border);
    }
}
</style>