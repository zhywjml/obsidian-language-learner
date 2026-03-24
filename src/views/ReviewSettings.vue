<template>
    <div class="review-settings">
        <h3>{{ t("Review Settings") }}</h3>

        <!-- 每日新卡片上限 -->
        <div class="setting-item">
            <label>{{ t("Daily New Cards") }}</label>
            <input
                type="number"
                v-model.number="settings.dailyNewCards"
                @change="saveSettings"
                min="1"
                max="100"
            />
        </div>

        <!-- 每日复习上限 -->
        <div class="setting-item">
            <label>{{ t("Daily Review Cards") }}</label>
            <input
                type="number"
                v-model.number="settings.dailyReviewCards"
                @change="saveSettings"
                min="1"
                max="500"
            />
        </div>

        <!-- 界面设置 -->
        <div class="setting-section">
            <h4>{{ t("Interface Settings") }}</h4>

            <div class="setting-item">
                <label class="checkbox">
                    <input
                        type="checkbox"
                        v-model="settings.showAnswerButton"
                        @change="saveSettings"
                    />
                    {{ t("Show Answer Button") }}
                </label>
            </div>

            <div class="setting-item">
                <label class="checkbox">
                    <input
                        type="checkbox"
                        v-model="settings.autoPlayAudio"
                        @change="saveSettings"
                    />
                    {{ t("Auto Play Audio") }}
                </label>
            </div>
        </div>

        <!-- 数据管理 -->
        <div class="setting-section">
            <h4>{{ t("Data Management") }}</h4>
            <button class="clear-btn" @click="clearAllCards">
                {{ t("Clear All Cards") }}
            </button>
            <p class="clear-hint">{{ t("This will delete all review cards and allow re-import") }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, getCurrentInstance } from "vue";
import { Notice } from "obsidian";
import { t } from "@/lang/helper";
import { ReviewDb } from "@/db/review_db";
import { ReviewSettings, DEFAULT_REVIEW_SETTINGS } from "@/db/review_interface";
import type ReviewPanelView from "./ReviewPanelView";

const emit = defineEmits<{
    (e: 'cardsCleared'): void;
}>();

const vueThis = getCurrentInstance();
const view = vueThis?.appContext.config.globalProperties.view as ReviewPanelView;
const plugin = view?.app?.plugins?.plugins?.["obsidian-language-learner"];

const settings = ref<ReviewSettings>(DEFAULT_REVIEW_SETTINGS);
let reviewDb: ReviewDb | null = null;

onMounted(async () => {
    if (!plugin) {
        console.error("[ReviewSettings] Plugin not found");
        return;
    }

    reviewDb = new ReviewDb(plugin.app.vault);
    await reviewDb.init();

    const loadedSettings = await reviewDb.getSettings();
    if (loadedSettings) {
        settings.value = { ...DEFAULT_REVIEW_SETTINGS, ...loadedSettings };
    }
});

async function saveSettings() {
    if (!reviewDb) return;
    await reviewDb.saveSettings(settings.value);
    new Notice(t("Settings saved"));
}

async function clearAllCards() {
    if (!reviewDb) return;

    const confirmed = confirm(t("Are you sure you want to delete all review cards?"));
    if (!confirmed) return;

    try {
        await reviewDb.saveCards([]);
        await reviewDb.clearDailyQueues();
        new Notice(t("All cards cleared. You can now re-import."));
        emit('cardsCleared');
    } catch (error) {
        console.error("[ReviewSettings] Failed to clear cards:", error);
        new Notice(t("Failed to clear cards"));
    }
}
</script>

<style scoped lang="scss">
.review-settings {
    padding: 16px;
    color: var(--text-normal);

    h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
    }

    h4 {
        margin: 16px 0 12px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
    }
}

.setting-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
}

.setting-item {
    margin-bottom: 12px;

    label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        color: var(--text-normal);

        &.checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }
    }

    input[type="number"] {
        width: 80px;
        padding: 6px 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 13px;

        &:focus {
            outline: none;
            border-color: var(--interactive-accent);
        }
    }

    input[type="checkbox"] {
        margin: 0;
    }
}

.clear-btn {
    width: 100%;
    padding: 10px 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);
    transition: all 0.2s ease;

    &:hover {
        background: #ff4444;
        color: white;
        border-color: #ff4444;
    }
}

.clear-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 8px;
    margin-bottom: 0;
}
</style>
