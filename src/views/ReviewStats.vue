<template>
    <div class="review-stats-panel">
        <h3>{{ t("Review Statistics") }}</h3>

        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-number">{{ stats.total }}</span>
                <span class="stat-label">{{ t("Total Cards") }}</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">{{ stats.new }}</span>
                <span class="stat-label">{{ t("New") }}</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">{{ stats.learning }}</span>
                <span class="stat-label">{{ t("Learning") }}</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">{{ stats.review }}</span>
                <span class="stat-label">{{ t("Review") }}</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">{{ stats.mastered }}</span>
                <span class="stat-label">{{ t("Mastered") }}</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">{{ stats.dueToday }}</span>
                <span class="stat-label">{{ t("Due Today") }}</span>
            </div>
        </div>

        <div class="today-progress" v-if="todayStats">
            <h4>{{ t("Today's Progress") }}</h4>
            <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
                {{ todayStats.newCompleted }}/{{ todayStats.newTotal }} {{ t("New") }} |
                {{ todayStats.reviewCompleted }}/{{ todayStats.reviewTotal }} {{ t("Review") }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { t } from "@/lang/helper";
import { ReviewDb } from "@/db/review_db";

const props = defineProps<{
    reviewDb: ReviewDb;
}>();

const stats = ref({
    total: 0,
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0,
    dueToday: 0
});

const todayStats = ref<any>(null);

const progressPercent = computed(() => {
    if (!todayStats.value) return 0;
    const total = todayStats.value.newTotal + todayStats.value.reviewTotal;
    const completed = todayStats.value.newCompleted + todayStats.value.reviewCompleted;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
});

onMounted(async () => {
    stats.value = await props.reviewDb.getStats();
});
</script>

<style scoped lang="scss">
.review-stats-panel {
    padding: 20px;
    color: var(--text-normal);

    h3 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
    }

    h4 {
        margin: 20px 0 12px 0;
        font-size: 14px;
        font-weight: 600;
    }
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
}

.stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 8px;
    text-align: center;

    .stat-number {
        font-size: 24px;
        font-weight: 700;
        color: var(--interactive-accent);
        margin-bottom: 4px;
    }

    .stat-label {
        font-size: 12px;
        color: var(--text-muted);
    }
}

.today-progress {
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 8px;

    .progress-bar {
        height: 8px;
        background: var(--background-modifier-border);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
    }

    .progress-fill {
        height: 100%;
        background: var(--interactive-accent);
        transition: width 0.3s ease;
    }

    .progress-text {
        font-size: 13px;
        color: var(--text-muted);
        text-align: center;
    }
}
</style>
