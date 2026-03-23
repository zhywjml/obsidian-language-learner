<template>
    <div id="iciba">
        <h2>{{ word }}</h2>
        <div class="pronunces">
            <span class="pron" v-for="pron in prons" @click="playAudio(pron.url)">{{
                pron.phsym
            }}</span>
        </div>
        <div class="parts" v-if="parts.length > 0">
            <div class="part-item" v-for="item in parts">
                <span class="pos" v-if="item.part">{{ item.part }}</span>
                <span class="means">{{ item.means.join('；') }}</span>
            </div>
        </div>
        <div class="sentences" v-if="sentences.length > 0" ref="sentencesRef">
            <h3 class="section-header" @click="toggleSentences">
                {{ t('Sentences') }}
                <span class="toggle-hint">{{ showAllSentences ? '收起' : `展开 (${sentences.length})` }}</span>
            </h3>
            <div class="sentences-container" :class="{ 'collapsed': !showAllSentences }">
                <div class="sentence-item" v-for="(sentence, index) in sentences" :key="index">
                    <p class="en">{{ sentence.en }}</p>
                    <p class="cn">{{ sentence.cn }}</p>
                    <p class="from" v-if="sentence.from">—— {{ sentence.from }}</p>
                </div>
            </div>
        </div>
        <div class="collins" v-if="collins && collins.length > 0" ref="collinsRef">
            <h3 class="section-header" @click="toggleCollins">
                柯林斯
                <span class="toggle-hint">{{ showAllCollins ? '收起' : `展开 (${collins.length})` }}</span>
            </h3>
            <div class="collins-container" :class="{ 'collapsed': !showAllCollins }">
                <div class="collins-item" v-for="(item, index) in collins" :key="index">
                    <p class="def">
                        <span class="posp" v-if="item.posp">[{{ item.posp }}]</span>
                        {{ item.def }}
                    </p>
                    <p class="tran" v-if="item.tran">{{ item.tran }}</p>
                    <div class="examples" v-if="item.examples && item.examples.length > 0">
                        <div class="example" v-for="(ex, exIndex) in item.examples" :key="exIndex">
                            <p class="ex">{{ ex.ex }}</p>
                            <p class="ex-tran">{{ ex.tran }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

import { search, IcibaResult } from "./engine"
import { useLoading } from "@dict/uses"
import { playAudio } from "@/utils/helpers"
import { t } from "@/lang/helper"

const props = defineProps<{
    word: string,
}>()

const emits = defineEmits<{
    (event: "loading", status: { id: string, loading: boolean, result: boolean }): void
}>()

let word = ref("")
let prons = ref<IcibaResult['prons']>([])
let parts = ref<IcibaResult['parts']>([])
let sentences = ref<IcibaResult['sentences']>([])
let collins = ref<IcibaResult['collins']>([])

let showAllSentences = ref(false)
let showAllCollins = ref(false)

function toggleSentences() {
    showAllSentences.value = !showAllSentences.value
}

function toggleCollins() {
    showAllCollins.value = !showAllCollins.value
}

async function onSearch(): Promise<boolean> {
    let res = await search(props.word)
    if (!res) {
        return false;
    }
    let result = res.result as IcibaResult;
    word.value = result.word;
    prons.value = result.prons;
    parts.value = result.parts;
    sentences.value = result.sentences;
    collins.value = result.collins || [];

    // 重置展开状态
    showAllSentences.value = false;
    showAllCollins.value = false;

    await nextTick();
    return true;
}

useLoading(() => props.word, "iciba", onSearch, emits);
</script>

<style lang="scss">
#iciba {
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

    .parts {
        margin: 10px 0;

        .part-item {
            margin: 6px 0;
            line-height: 1.6;

            .pos {
                display: inline-block;
                color: var(--interactive-accent);
                font-weight: 500;
                margin-right: 8px;
                font-style: italic;
            }

            .means {
                color: var(--text-normal);
            }
        }
    }

    .section-header {
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 8px;

        &:hover {
            opacity: 0.8;
        }

        .toggle-hint {
            font-size: 0.75em;
            color: var(--text-muted);
            font-weight: normal;
        }
    }

    .sentences {
        margin-top: 15px;

        h3 {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--interactive-accent);
        }

        .sentences-container {
            max-height: 400px;
            overflow-y: auto;
            padding-right: 5px;

            &::-webkit-scrollbar {
                width: 6px;
            }

            &::-webkit-scrollbar-track {
                background: var(--background-modifier-border);
                border-radius: 3px;
            }

            &::-webkit-scrollbar-thumb {
                background: var(--interactive-accent);
                border-radius: 3px;
                opacity: 0.5;

                &:hover {
                    opacity: 0.8;
                }
            }

            &.collapsed {
                max-height: 150px;
            }
        }

        .sentence-item {
            margin: 10px 0;
            padding: 8px 10px;
            border-radius: 6px;
            background-color: var(--background-secondary);

            .en {
                color: var(--text-normal);
                font-size: 0.95em;
                margin: 0;
            }

            .cn {
                color: var(--text-muted);
                font-size: 0.9em;
                margin: 4px 0 0 0;
            }

            .from {
                color: var(--text-faint);
                font-size: 0.85em;
                margin: 2px 0 0 0;
                font-style: italic;
            }
        }
    }

    .collins {
        margin-top: 15px;

        h3 {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--interactive-accent);
        }

        .collins-container {
            max-height: 500px;
            overflow-y: auto;
            padding-right: 5px;

            &::-webkit-scrollbar {
                width: 6px;
            }

            &::-webkit-scrollbar-track {
                background: var(--background-modifier-border);
                border-radius: 3px;
            }

            &::-webkit-scrollbar-thumb {
                background: var(--interactive-accent);
                border-radius: 3px;
                opacity: 0.5;

                &:hover {
                    opacity: 0.8;
                }
            }

            &.collapsed {
                max-height: 150px;
            }
        }

        .collins-item {
            margin: 12px 0;
            padding: 10px;
            border-radius: 6px;
            background-color: var(--background-secondary);

            .def {
                color: var(--text-normal);
                font-size: 0.95em;
                margin: 0;

                .posp {
                    color: var(--interactive-accent);
                    font-weight: 500;
                    margin-right: 6px;
                }
            }

            .tran {
                color: var(--text-muted);
                font-size: 0.9em;
                margin: 4px 0 0 0;
            }

            .examples {
                margin-top: 8px;
                padding-left: 12px;
                border-left: 2px solid var(--interactive-accent);

                .example {
                    margin: 6px 0;

                    .ex {
                        color: var(--text-normal);
                        font-size: 0.9em;
                        margin: 0;
                    }

                    .ex-tran {
                        color: var(--text-muted);
                        font-size: 0.85em;
                        margin: 2px 0 0 0;
                    }
                }
            }
        }
    }
}

.theme-dark #iciba {
    .sentences .sentence-item,
    .collins .collins-item {
        background-color: var(--background-secondary-alt);
    }
}
</style>