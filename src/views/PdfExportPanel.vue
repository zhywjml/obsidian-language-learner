<template>
    <div id="pdf-export-panel" v-if="visible">
        <div class="export-modal-overlay" @click.self="close">
            <div class="export-modal">
                <div class="modal-header">
                    <h3>{{ t('Export to PDF') }}</h3>
                    <button class="close-btn" @click="close">×</button>
                </div>

                <div class="modal-body">
                    <!-- 标题设置 -->
                    <div class="form-group">
                        <label>{{ t('Title') }}</label>
                        <input
                            type="text"
                            v-model="settings.title"
                            :placeholder="t('Article title')"
                        />
                    </div>

                    <div class="form-group">
                        <label>{{ t('Subtitle') }}</label>
                        <input
                            type="text"
                            v-model="settings.subtitle"
                            :placeholder="t('Optional')"
                        />
                    </div>

                    <!-- 日期 -->
                    <div class="form-group">
                        <label>{{ t('Date') }}</label>
                        <input type="date" v-model="settings.date" />
                    </div>

                    <!-- 选项 -->
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settings.showPhonetic" />
                            {{ t('Show phonetic') }}
                        </label>
                    </div>

                    <!-- 单词列表 -->
                    <div class="form-group">
                        <label>{{ t('Words to include') }} ({{ selectedWords.length }})</label>
                        <div class="word-list">
                            <div
                                v-for="word in availableWords"
                                :key="word.expression"
                                class="word-item"
                            >
                                <input
                                    type="checkbox"
                                    :value="word.expression"
                                    v-model="selectedWords"
                                />
                                <span class="word-name">{{ word.expression }}</span>
                                <span class="word-preview" v-if="word.meaning">
                                    {{ truncate(word.meaning, 30) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" @click="close">
                        {{ t('Cancel') }}
                    </button>
                    <button
                        class="btn-primary"
                        @click="exportPDF"
                        :disabled="exporting"
                    >
                        <span v-if="exporting">{{ t('Exporting...') }}</span>
                        <span v-else>{{ t('Export PDF') }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { t } from '@/lang/helper';
import { pdfExportService, WordEntry, NewspaperSettings } from '@/services/pdf-export.service';

interface Props {
    visible: boolean;
    articleContent: string;
    articleElement: HTMLElement | null;
    defaultTitle: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'exported'): void;
}>();

// 设置
const settings = ref<NewspaperSettings>({
    title: '',
    subtitle: '',
    date: new Date().toISOString().split('T')[0],
    showPhonetic: true,
});

// 单词列表
const availableWords = ref<WordEntry[]>([]);
const selectedWords = ref<string[]>([]);
const exporting = ref(false);

// 初始化
watch(() => props.visible, (visible) => {
    if (visible) {
        settings.value.title = props.defaultTitle;
        scanWords();
    }
}, { immediate: true });

// 扫描单词
function scanWords() {
    if (!props.articleElement) return;

    // 扫描 DOM 中的单词
    const wordElements = props.articleElement.querySelectorAll('[data-word]');
    const words: WordEntry[] = [];
    const seen = new Set<string>();

    wordElements.forEach(el => {
        const word = el.getAttribute('data-word');
        if (word && !seen.has(word.toLowerCase())) {
            seen.add(word.toLowerCase());
            words.push({
                expression: word,
                phonetic: el.getAttribute('data-phonetic') || undefined,
                meaning: el.getAttribute('data-meaning') || '',
            });
        }
    });

    availableWords.value = words;
    selectedWords.value = words.map(w => w.expression);
}

// 截断文本
function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

// 关闭面板
function close() {
    emit('close');
}

// 导出 PDF
async function exportPDF() {
    if (selectedWords.value.length === 0) {
        alert(t('Please select at least one word'));
        return;
    }

    exporting.value = true;

    try {
        const words = availableWords.value.filter(w =>
            selectedWords.value.includes(w.expression)
        );

        const blob = await pdfExportService.exportToPDF({
            articleContent: props.articleContent,
            words,
            settings: settings.value,
            filename: settings.value.title,
        });

        pdfExportService.downloadPDF(blob, settings.value.title);
        emit('exported');
        close();
    } catch (error) {
        console.error('PDF export failed:', error);
        alert(t('PDF export failed'));
    } finally {
        exporting.value = false;
    }
}
</script>

<style scoped lang="scss">
#pdf-export-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
}

.export-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
}

.export-modal {
    background: var(--background-primary);
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);

    h3 {
        margin: 0;
        font-size: 18px;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--text-muted);

        &:hover {
            color: var(--text-normal);
        }
    }
}

.modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}

.form-group {
    margin-bottom: 16px;

    label {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        color: var(--text-normal);
    }

    input[type="text"],
    input[type="date"] {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;

        &:focus {
            outline: none;
            border-color: var(--interactive-accent);
        }
    }
}

.checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    input[type="checkbox"] {
        margin: 0;
    }
}

.word-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 8px;
}

.word-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;

    input[type="checkbox"] {
        margin: 0;
    }

    .word-name {
        font-weight: 500;
        min-width: 80px;
    }

    .word-preview {
        color: var(--text-muted);
        font-size: 12px;
        flex: 1;
    }
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
}

.btn-secondary,
.btn-primary {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);

    &:hover {
        background: var(--background-secondary-alt);
    }
}

.btn-primary {
    background: var(--interactive-accent);
    border: 1px solid var(--interactive-accent);
    color: var(--text-on-accent);

    &:hover:not(:disabled) {
        opacity: 0.9;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}
</style>
