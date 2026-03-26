<template>
    <div class="word-list-by-date">
        <div v-if="words.length === 0" class="empty-state">
            {{ t("No words recorded on this date") }}
        </div>
        <div v-else class="word-list">
            <div
                v-for="word in words"
                :key="word.expression"
                class="word-item"
                :class="`status-${word.status}`"
            >
                <div class="word-header">
                    <span class="word-text">{{ word.expression }}</span>
                    <span class="word-type">{{ word.t === "WORD" ? t("Word") : t("Phrase") }}</span>
                    <span class="word-status" :style="getStatusStyle(word.status)">
                        {{ getStatusLabel(word.status) }}
                    </span>
                </div>
                <div class="word-meaning">{{ word.meaning }}</div>
                <div class="word-meta">
                    <span class="meta-item">
                        <span class="meta-label">{{ t("Created") }}:</span>
                        {{ word.createdDate }}
                    </span>
                    <span class="meta-item">
                        <span class="meta-label">{{ t("Modified") }}:</span>
                        {{ word.modifiedDate }}
                    </span>
                    <span v-if="word.tags.length > 0" class="meta-item">
                        <span class="meta-label">{{ t("Tags") }}:</span>
                        {{ word.tags.join(", ") }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { t } from "@/lang/helper";
import type { ExpressionInfo } from "@/db/interface";

const props = defineProps<{
    words: ExpressionInfo[];
}>();

const statusLabels = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned")
];

const statusColors = [
    "#999999", // Ignore
    "#e74c3c", // Learning
    "#f39c12", // Familiar
    "#3498db", // Known
    "#27ae60"  // Learned
];

function getStatusLabel(status: number): string {
    return statusLabels[status] || t("Unknown");
}

function getStatusStyle(status: number) {
    return {
        backgroundColor: statusColors[status] || "#999999",
        color: "white",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px"
    };
}
</script>

<style scoped>
.word-list-by-date {
    max-height: 400px;
    overflow-y: auto;
}

.empty-state {
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
    font-style: italic;
}

.word-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.word-item {
    padding: 12px;
    border-radius: 6px;
    background-color: var(--background-secondary);
    border-left: 3px solid transparent;
}

.word-item.status-1 { border-left-color: #e74c3c; }
.word-item.status-2 { border-left-color: #f39c12; }
.word-item.status-3 { border-left-color: #3498db; }
.word-item.status-4 { border-left-color: #27ae60; }

.word-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}

.word-text {
    font-weight: bold;
    font-size: 16px;
}

.word-type {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--background-modifier-hover);
    padding: 2px 6px;
    border-radius: 3px;
}

.word-meaning {
    font-size: 14px;
    color: var(--text-normal);
    margin-bottom: 8px;
    line-height: 1.4;
}

.word-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--text-muted);
}

.meta-item {
    display: flex;
    gap: 4px;
}

.meta-label {
    font-weight: 500;
}
</style>
