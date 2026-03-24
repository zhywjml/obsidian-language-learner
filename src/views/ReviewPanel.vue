<template>
    <div class="review-panel">
        <!-- 顶部统计栏 -->
        <div class="review-header">
            <div class="review-title">
                <span class="review-icon">🧠</span>
                <span>{{ t("Smart Review") }}</span>
            </div>
            <div class="review-stats">
                <div class="stat-item">
                    <span class="stat-label">{{ t("New") }}</span>
                    <span class="stat-value new">{{ todayStats.newCompleted }}/{{ todayStats.newTotal }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">{{ t("Review") }}</span>
                    <span class="stat-value review">{{ todayStats.reviewCompleted }}/{{ todayStats.reviewTotal }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">{{ t("Remaining") }}</span>
                    <span class="stat-value remaining">{{ remainingCards.total }}</span>
                </div>
            </div>
        </div>

        <!-- 复习主区域 -->
        <div class="review-content" v-if="currentCard">
            <!-- 卡片正面 -->
            <div class="review-card" :class="{ 'flipped': showAnswer }" @click="flipCard">
                <div class="card-side card-front">
                    <div class="card-type-badge">{{ getCardTypeLabel(currentCard.type) }}</div>
                    <div class="card-content" v-html="renderFront(currentCard)"></div>
                    <div class="card-hint" v-if="!showAnswer">
                        {{ t("Click to show answer") }}
                    </div>
                </div>
                <div class="card-side card-back" v-if="showAnswer">
                    <div class="card-divider"></div>
                    <div class="card-content" v-html="renderBack(currentCard)"></div>
                </div>
            </div>

            <!-- 难度评分按钮 -->
            <div class="review-buttons" v-if="showAnswer">
                <button
                    class="review-btn again"
                    @click="rateCard('again')"
                    :title="t('Again - < 1m')"
                >
                    <span class="btn-label">{{ t("Again") }}</span>
                    <span class="btn-interval">&lt; 1m</span>
                </button>
                <button
                    class="review-btn hard"
                    @click="rateCard('hard')"
                    :title="t('Hard')"
                >
                    <span class="btn-label">{{ t("Hard") }}</span>
                    <span class="btn-interval">{{ getButtonInterval('hard') }}</span>
                </button>
                <button
                    class="review-btn good"
                    @click="rateCard('good')"
                    :title="t('Good')"
                >
                    <span class="btn-label">{{ t("Good") }}</span>
                    <span class="btn-interval">{{ getButtonInterval('good') }}</span>
                </button>
                <button
                    class="review-btn easy"
                    @click="rateCard('easy')"
                    :title="t('Easy')"
                >
                    <span class="btn-label">{{ t("Easy") }}</span>
                    <span class="btn-interval">{{ getButtonInterval('easy') }}</span>
                </button>
            </div>
        </div>

        <!-- 空状态 -->
        <div class="review-empty" v-else>
            <div class="empty-icon">🎉</div>
            <div class="empty-title">{{ t("All done!") }}</div>
            <div class="empty-desc">{{ t("No cards due for review today.") }}</div>
            <button class="empty-action" @click="importFromDatabase">
                {{ t("Import from word database") }}
            </button>
        </div>

        <!-- 底部工具栏 -->
        <div class="review-toolbar">
            <button class="toolbar-btn" @click="showSettingsPanel = !showSettingsPanel">
                <span>⚙️</span>
                <span>{{ t("Settings") }}</span>
            </button>
            <button class="toolbar-btn" @click="skipCard" :disabled="!currentCard">
                <span>⏭️</span>
                <span>{{ t("Skip") }}</span>
            </button>
            <button class="toolbar-btn" @click="showStats">
                <span>📊</span>
                <span>{{ t("Stats") }}</span>
            </button>
        </div>

        <!-- 设置面板 -->
        <div class="review-settings-panel" v-if="showSettingsPanel">
            <ReviewSettings @cards-cleared="loadNextCard" />
        </div>

        <!-- 统计面板弹窗 -->
        <div class="modal-overlay" v-if="showStatsPanel" @click.self="showStatsPanel = false">
            <div class="modal-content">
                <button class="modal-close" @click="showStatsPanel = false">×</button>
                <ReviewStats v-if="reviewDb" :reviewDb="reviewDb" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, getCurrentInstance } from "vue";
import { Notice } from "obsidian";
import { t } from "@/lang/helper";
import { ReviewDb } from "@/db/review_db";
import { CardScheduler } from "@/review/card_scheduler";
import { calculateNextReview, getQualityFromButton, getButtonInterval as getInterval } from "@/review/sm2";
import { ReviewCard, ReviewSettings, DEFAULT_REVIEW_SETTINGS } from "@/db/review_interface";
import type ReviewPanelView from "./ReviewPanelView";
import ReviewSettingsComponent from "./ReviewSettings.vue";
import ReviewStatsComponent from "./ReviewStats.vue";

// 注册子组件
const ReviewSettings = ReviewSettingsComponent;
const ReviewStats = ReviewStatsComponent;

const vueThis = getCurrentInstance();
const view = vueThis?.appContext.config.globalProperties.view as ReviewPanelView;
const plugin = view?.app?.plugins?.plugins?.["obsidian-language-learner"];

// 状态
const currentCard = ref<ReviewCard | null>(null);
const showAnswer = ref(false);
const showSettingsPanel = ref(false);
const showStatsPanel = ref(false);
const remainingCards = ref({ newCards: [] as ReviewCard[], reviewCards: [] as ReviewCard[], total: 0 });
const todayStats = ref({ newTotal: 0, newCompleted: 0, reviewTotal: 0, reviewCompleted: 0 });
const settings = ref<ReviewSettings>(DEFAULT_REVIEW_SETTINGS);

// 数据管理
let reviewDb: ReviewDb | null = null;
let scheduler: CardScheduler | null = null;

onMounted(async () => {
    if (!plugin) {
        console.error("[ReviewPanel] Plugin not found");
        return;
    }

    // 初始化数据库和调度器
    reviewDb = new ReviewDb(plugin.app.vault);
    await reviewDb.init();
    scheduler = new CardScheduler(reviewDb);

    // 加载设置
    const loadedSettings = await reviewDb.getSettings();
    if (loadedSettings) {
        settings.value = loadedSettings;
    }

    // 生成今日队列并加载第一张卡片
    await loadNextCard();
});

// 加载下一张卡片
async function loadNextCard() {
    if (!scheduler || !reviewDb) return;

    // 生成今日队列
    await scheduler.generateDailyQueue();

    // 获取剩余卡片
    remainingCards.value = await scheduler.getRemainingCards();

    // 获取今日统计
    todayStats.value = await scheduler.getTodayStats();

    // 获取下一张卡片
    const dueCards = await reviewDb.getDueCards();
    const uncompletedDueCards = dueCards.filter(
        c => !remainingCards.value.newCards.some(nc => nc.id === c.id) &&
             !remainingCards.value.reviewCards.some(rc => rc.id === c.id)
    );

    if (remainingCards.value.newCards.length > 0) {
        currentCard.value = remainingCards.value.newCards[0];
    } else if (remainingCards.value.reviewCards.length > 0) {
        currentCard.value = remainingCards.value.reviewCards[0];
    } else if (uncompletedDueCards.length > 0) {
        currentCard.value = uncompletedDueCards[0];
    } else {
        currentCard.value = null;
    }

    showAnswer.value = false;
}

// 翻转卡片
function flipCard() {
    if (!settings.value.showAnswerButton) {
        showAnswer.value = true;
    } else {
        showAnswer.value = !showAnswer.value;
    }
}

// 评分卡片
async function rateCard(button: "again" | "hard" | "good" | "easy") {
    if (!currentCard.value || !reviewDb || !scheduler) return;

    const quality = getQualityFromButton(button);
    const result = calculateNextReview({
        quality,
        interval: currentCard.value.interval,
        repetitions: currentCard.value.repetitions,
        easeFactor: currentCard.value.easeFactor
    });

    // 更新卡片
    await reviewDb.updateCard(currentCard.value.id, {
        interval: result.interval,
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
        nextReviewDate: result.nextReviewDate,
        lastReviewDate: new Date().toISOString().split('T')[0],
        totalReviews: currentCard.value.totalReviews + 1,
        correctCount: quality >= 3 ? currentCard.value.correctCount + 1 : currentCard.value.correctCount,
        wrongCount: quality < 3 ? currentCard.value.wrongCount + 1 : currentCard.value.wrongCount
    });

    // 标记完成
    await scheduler.markCompleted(currentCard.value.id);

    // 加载下一张
    await loadNextCard();
}

// 获取按钮间隔提示
function getButtonInterval(button: "again" | "hard" | "good" | "easy"): string {
    if (!currentCard.value) return "?";
    return getInterval(button, currentCard.value.interval, currentCard.value.easeFactor);
}

// 渲染卡片正面 - 只显示单词
function renderFront(card: ReviewCard): string {
    if (card.type === "word" && card.word) {
        return `<div class="card-word">${card.word}</div>`;
    } else if (card.type === "sentence" && card.sentence) {
        return `<div class="card-sentence">${card.sentence}</div>`;
    }
    return "<div class=\"card-word\">?</div>";
}

// 渲染卡片背面
// 渲染卡片背面 - 含义 + 例句
function renderBack(card: ReviewCard): string {
    const parts: string[] = [];

    // 含义区域
    if (card.meaning) {
        parts.push(`<div class="back-section">
            <div class="back-label">${t("Meaning")}</div>
            <div class="back-meaning">${card.meaning}</div>
        </div>`);
    }

    // 例句区域
    if (card.sentence) {
        parts.push(`<div class="back-section">
            <div class="back-label">${t("Example")}</div>
            <div class="back-sentence">${card.sentence}</div>
        </div>`);

        if (card.translation) {
            parts.push(`<div class="back-translation">${card.translation}</div>`);
        }
    }

    return parts.join("");
}

// 获取卡片类型标签
function getCardTypeLabel(type: string): string {
    return type === "word" ? t("Word") : t("Sentence");
}

// 跳过当前卡片
async function skipCard() {
    if (!currentCard.value || !scheduler) return;
    await scheduler.markCompleted(currentCard.value.id);
    await loadNextCard();
}

// 从数据库导入
async function importFromDatabase() {
    if (!reviewDb || !plugin) {
        new Notice(t("Review system not initialized"));
        return;
    }

    if (!scheduler) {
        new Notice(t("Scheduler not initialized"));
        return;
    }

    try {
        // 获取所有单词（使用getExpressionAfter获取完整信息包括例句）
        const expressions = await plugin.db.getExpressionAfter("1970-01-01T00:00:00Z");

        if (!expressions || expressions.length === 0) {
            new Notice(t("No words found in database"));
            return;
        }

        // 过滤出可导入的单词（status >= 1）
        const learnableWords = expressions.filter(e => e.status >= 1);

        if (learnableWords.length === 0) {
            new Notice(t("No learnable words found (status must be Learning or higher)"));
            return;
        }

        const imported = await scheduler.importFromExpressions(expressions);

        if (imported > 0) {
            new Notice(t(`Imported ${imported} cards from database`));
            await loadNextCard();
        } else {
            // 检查是否已存在
            const existingCards = await reviewDb.getCards();
            const allExisting = learnableWords.every(w =>
                existingCards.some(c => c.expressionId === w.expression)
            );
            if (allExisting) {
                new Notice(t("All learnable words already imported"));
            } else {
                new Notice(t("No new cards to import"));
            }
        }
    } catch (error) {
        console.error("[ReviewPanel] Import error:", error);
        new Notice(t("Import failed: ") + error.message);
    }
}

// 打开设置
function openSettings() {
    showSettingsPanel.value = !showSettingsPanel.value;
}

// 显示统计
function showStats() {
    showStatsPanel.value = true;
}
</script>

<style scoped lang="scss">
.review-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    color: var(--text-normal);
}

.review-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.review-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;

    .review-icon {
        font-size: 20px;
    }
}

.review-stats {
    display: flex;
    gap: 16px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.stat-label {
    font-size: 11px;
    color: var(--text-muted);
}

.stat-value {
    font-size: 14px;
    font-weight: 600;

    &.new { color: var(--text-accent); }
    &.review { color: var(--text-highlight-bg); }
    &.remaining { color: var(--text-normal); }
}

.review-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    gap: 20px;
    overflow-y: auto;
}

.review-card {
    flex: 1;
    background: var(--background-secondary);
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    overflow: hidden;
    position: relative;

    &:hover {
        border-color: var(--interactive-accent);
    }

    &.flipped {
        cursor: default;
    }
}

.card-back {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding-right: 8px;

    // 自定义滚动条
    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: var(--background-modifier-border);
        border-radius: 3px;
    }
}

.card-type-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 4px 8px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
}

.card-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

.card-front {
    gap: 16px;
}

.card-content {
    text-align: center;
    font-size: 24px;
    line-height: 1.5;
    width: 100%;
    max-height: 100%;
    overflow-y: auto;
}

.card-back .card-content {
    text-align: left;
    font-size: 14px;
    padding: 0 8px;
}

.card-word {
    font-size: 32px;
    font-weight: 600;
}

.card-pronunciation {
    font-size: 16px;
    color: var(--text-muted);
    font-family: serif;
}

.card-sentence {
    font-size: 20px;
}

.card-translation {
    font-size: 18px;
    color: var(--text-muted);
}

.card-meaning {
    font-size: 20px;
    color: var(--text-highlight-bg);
}

.card-example {
    font-size: 16px;
    color: var(--text-muted);
    font-style: italic;
}

// Beautiful card sections for back display
.back-section {
    width: 100%;
    margin-bottom: 10px;

    &:last-child {
        margin-bottom: 0;
    }
}

.back-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    font-weight: 600;
}

.back-meaning {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-normal);
    padding: 10px 12px;
    background: var(--background-primary);
    border-radius: 6px;
    border-left: 2px solid var(--interactive-accent);
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
}

.back-sentence {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-normal);
    font-style: italic;
    padding: 10px 12px;
    background: var(--background-primary);
    border-radius: 6px;
    border-left: 2px solid var(--text-highlight-bg);
    text-align: left;
    margin-bottom: 6px;
    white-space: pre-wrap;
    word-break: break-word;
}

.back-translation {
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted);
    padding: 8px 12px;
    background: var(--background-secondary-alt);
    border-radius: 6px;
    text-align: left;
    border-left: 2px solid var(--text-muted);
    white-space: pre-wrap;
    word-break: break-word;
}

.card-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: auto;
}

.card-divider {
    width: 100%;
    height: 1px;
    background: var(--background-modifier-border);
    margin: 20px 0;
}

.review-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}

.review-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    gap: 4px;

    .btn-label {
        font-size: 14px;
        font-weight: 600;
    }

    .btn-interval {
        font-size: 11px;
        opacity: 0.8;
    }

    &.again {
        background: #ff4444;
        color: white;
        &:hover { background: #cc0000; }
    }

    &.hard {
        background: #ff8844;
        color: white;
        &:hover { background: #cc6633; }
    }

    &.good {
        background: #44aa44;
        color: white;
        &:hover { background: #338833; }
    }

    &.easy {
        background: #4488ff;
        color: white;
        &:hover { background: #3366cc; }
    }
}

.review-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px;
}

.empty-icon {
    font-size: 48px;
}

.empty-title {
    font-size: 20px;
    font-weight: 600;
}

.empty-desc {
    font-size: 14px;
    color: var(--text-muted);
}

.empty-action {
    padding: 10px 20px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;

    &:hover {
        background: var(--interactive-accent-hover);
    }
}

.review-toolbar {
    padding: 12px 16px;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: center;
    gap: 12px;
}

.toolbar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);

    &:hover {
        background: var(--background-secondary-alt);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.review-settings-panel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 400px;
    max-height: 80%;
    overflow-y: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
}

// Modal styles
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    position: relative;
    background: var(--background-primary);
    border-radius: 12px;
    min-width: 400px;
    max-width: 90vw;
    max-height: 90vh;
    overflow: auto;
}

.modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
    z-index: 10;

    &:hover {
        color: var(--text-normal);
    }
}
</style>
