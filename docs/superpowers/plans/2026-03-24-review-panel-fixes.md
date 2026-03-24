# Review Panel Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 UI/UX issues in the smart review system: card display design, button label consistency, dropdown menu style, statistics calculation, and stats panel functionality.

**Architecture:** Single-file Vue component modifications with focused CSS improvements. Maintain existing SM-2 algorithm and data layer, only modify presentation and user interaction patterns.

**Tech Stack:** Vue 3, TypeScript, SCSS, Obsidian API

---

## Issues Summary

1. **Card Display Design** - Back of card shows meaning and example poorly formatted
2. **Button Labels** - "Again" shows Chinese "忘记" while others show English "Hard"/"Good"/"Easy"
3. **Dropdown Style** - Default mode select should match ReadingArea's DockPagination dropdown (hover to show menu)
4. **Statistics Always 0/0** - Queue generation and stats calculation logic issues
5. **Stats Panel Not Opening** - `showStats` function not implemented

---

## Task 1: Fix Card Display Design

**Files:**
- Modify: `src/views/ReviewPanel.vue:243-305` (renderFront/renderBack functions)
- Modify: `src/views/ReviewPanel.vue:447-495` (card styles)

**Requirements:**
- Front: Show only the word (large, centered)
- Back: Show meaning (prominent) + example sentence with translation (if available)
- Use card.meaning and card.sentence fields from imported expressions
- Beautiful typography with proper spacing and hierarchy

- [ ] **Step 1: Update renderBack function for beautiful display**

Replace the renderBack function to show meaning prominently and example sentence beautifully:

```typescript
function renderBack(card: ReviewCard): string {
    const parts: string[] = [];

    // Meaning section - prominent
    if (card.meaning) {
        parts.push(`<div class="card-meaning-section">
            <div class="section-label">${t("Meaning")}</div>
            <div class="card-meaning">${card.meaning}</div>
        </div>`);
    }

    // Example sentence section
    if (card.sentence) {
        parts.push(`<div class="card-example-section">
            <div class="section-label">${t("Example")}</div>
            <div class="card-example">${card.sentence}</div>
        </div>`);
    }

    return parts.join("");
}
```

- [ ] **Step 2: Add beautiful CSS styles**

Add these styles in the `<style>` section:

```scss
.card-meaning-section,
.card-example-section {
    width: 100%;
    margin-bottom: 20px;

    &:last-child {
        margin-bottom: 0;
    }
}

.section-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
    font-weight: 500;
}

.card-meaning {
    font-size: 22px;
    line-height: 1.6;
    color: var(--text-normal);
    padding: 16px;
    background: var(--background-primary);
    border-radius: 8px;
    border-left: 3px solid var(--interactive-accent);
}

.card-example {
    font-size: 16px;
    line-height: 1.8;
    color: var(--text-muted);
    font-style: italic;
    padding: 16px;
    background: var(--background-primary);
    border-radius: 8px;
    border-left: 3px solid var(--text-highlight-bg);
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

---

## Task 2: Fix Button Label Consistency

**Files:**
- Modify: `src/views/ReviewPanel.vue:44-76` (button template)
- Modify: `src/lang/locale/zh.ts`, `en.ts`, `zh-TW.ts` (add translations)

**Requirements:**
- All 4 buttons (Again/Hard/Good/Easy) should use translated labels
- Remove hardcoded English from template

- [ ] **Step 1: Update button labels to use translations**

Current buttons have hardcoded English in titles. Update to:

```vue
<button
    class="review-btn again"
    @click="rateCard('again')"
    :title="t('Again') + ' - < 1m'"
>
    <span class="btn-label">{{ t("Again") }}</span>
    <span class="btn-interval">&lt; 1m</span>
</button>
```

- [ ] **Step 2: Add missing translations**

Add to `src/lang/locale/zh.ts`:
```typescript
"Again": "忘记",
"Hard": "困难",
"Good": "良好",
"Easy": "简单",
```

Add to `src/lang/locale/en.ts`:
```typescript
"Again": "Again",
"Hard": "Hard",
"Good": "Good",
"Easy": "Easy",
```

Add to `src/lang/locale/zh-TW.ts`:
```typescript
"Again": "忘記",
"Hard": "困難",
"Good": "良好",
"Easy": "簡單",
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

---

## Task 3: Fix Dropdown Menu Style

**Files:**
- Modify: `src/views/ReviewSettings.vue:5-13` (default mode select)
- Reference: `src/views/DockPagination.vue:32-57` (target style)

**Requirements:**
- Replace native `<select>` with custom hover dropdown like DockPagination
- Options: Word Only / Sentence Only / Mixed
- Should show current selection and dropdown on hover

- [ ] **Step 1: Replace select with custom dropdown component**

Replace the select element in ReviewSettings.vue:

```vue
<!-- 默认模式 -->
<div class="setting-item">
    <label>{{ t("Default Mode") }}</label>
    <div class="dropdown-menu-wrapper">
        <div
            class="dropdown-trigger"
            @mouseenter="showModeDropdown = true"
            @mouseleave="showModeDropdown = false"
        >
            <span class="dropdown-value">{{ modeLabel }}</span>
            <div class="dropdown-menu" v-show="showModeDropdown">
                <div
                    v-for="mode in modeOptions"
                    :key="mode.value"
                    class="dropdown-item"
                    :class="{ active: settings.defaultMode === mode.value }"
                    @click="selectMode(mode.value)"
                >{{ mode.label }}</div>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Add reactive state and computed properties**

Add to script setup:

```typescript
const showModeDropdown = ref(false);

const modeOptions = [
    { value: "word", label: t("Word Only") },
    { value: "sentence", label: t("Sentence Only") },
    { value: "mixed", label: t("Mixed") }
];

const modeLabel = computed(() => {
    const opt = modeOptions.find(o => o.value === settings.value.defaultMode);
    return opt ? opt.label : t("Mixed");
});

function selectMode(value: string) {
    settings.value.defaultMode = value as "word" | "sentence" | "mixed";
    saveSettings();
    showModeDropdown.value = false;
}
```

- [ ] **Step 3: Add CSS styles**

Add to `<style>` section:

```scss
.dropdown-menu-wrapper {
    position: relative;
}

.dropdown-trigger {
    position: relative;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    cursor: pointer;
    min-width: 120px;

    &:hover {
        border-color: var(--interactive-accent);
    }
}

.dropdown-value {
    font-size: 13px;
    color: var(--text-normal);
}

.dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 140px;
    margin-top: 4px;
    padding: 4px 0;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 100;
}

.dropdown-item {
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-normal);
    cursor: pointer;

    &:hover {
        background: var(--background-secondary);
    }

    &.active {
        color: var(--interactive-accent);
        font-weight: 600;
    }
}
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

---

## Task 4: Fix Statistics Calculation

**Files:**
- Modify: `src/review/card_scheduler.ts:17-60` (generateDailyQueue)
- Modify: `src/review/card_scheduler.ts:143-165` (getTodayStats)

**Issue Analysis:**
- The queue is only generated once per day (line 24-27 checks if exists)
- If cards are imported after queue generation, they won't be in today's queue
- Stats show 0/0 because queue was generated before any cards existed

**Requirements:**
- Allow regenerating queue when new cards are imported
- Show correct stats for current day

- [ ] **Step 1: Add force regeneration option to generateDailyQueue**

Modify function signature and add force parameter:

```typescript
async generateDailyQueue(date?: string, force?: boolean): Promise<DailyQueue> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 检查是否已生成 (unless force=true)
    const existing = await this.db.getDailyQueue(targetDate);
    if (existing && !force) {
        return existing;
    }

    // ... rest of function
}
```

- [ ] **Step 2: Update import function to regenerate queue**

After importing cards, regenerate the queue:

```typescript
async importFromExpressions(expressions: ExpressionInfo[]): Promise<number> {
    // ... existing import logic ...

    // If we imported cards, regenerate today's queue to include them
    if (imported > 0) {
        await this.generateDailyQueue(undefined, true);
    }

    return imported;
}
```

- [ ] **Step 3: Verify stats calculation includes all cards**

Ensure getTodayStats returns correct counts even if queue doesn't exist yet:

```typescript
async getTodayStats(date?: string): Promise<{
    newTotal: number;
    newCompleted: number;
    reviewTotal: number;
    reviewCompleted: number;
}> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get or generate queue
    let queue = await this.db.getDailyQueue(targetDate);
    if (!queue) {
        queue = await this.generateDailyQueue(targetDate);
    }

    return {
        newTotal: queue.newCards.length,
        newCompleted: queue.newCards.filter(c => queue!.completed.includes(c.id)).length,
        reviewTotal: queue.reviewCards.length,
        reviewCompleted: queue.reviewCards.filter(c => queue!.completed.includes(c.id)).length
    };
}
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

---

## Task 5: Implement Stats Panel

**Files:**
- Create: `src/views/ReviewStats.vue` (new component)
- Modify: `src/views/ReviewPanel.vue:335-340` (showStats function)
- Modify: `src/views/ReviewPanel.vue:89-104` (add stats panel modal)

**Requirements:**
- Show stats modal/panel when clicking Stats button
- Display: total cards, new cards, learning, review, mastered counts
- Show today's progress

- [ ] **Step 1: Create ReviewStats.vue component**

Create new file with basic stats display:

```vue
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
```

- [ ] **Step 2: Update ReviewPanel to show stats modal**

Add modal to template (around line 89-104):

```vue
<!-- 统计面板弹窗 -->
<div class="modal-overlay" v-if="showStatsPanel" @click.self="showStatsPanel = false">
    <div class="modal-content">
        <button class="modal-close" @click="showStatsPanel = false">×</button>
        <ReviewStats v-if="reviewDb" :reviewDb="reviewDb" />
    </div>
</div>
```

- [ ] **Step 3: Update showStats function**

Replace the placeholder function:

```typescript
const showStatsPanel = ref(false);

function showStats() {
    showStatsPanel.value = true;
}
```

- [ ] **Step 4: Add modal styles**

Add to ReviewPanel.vue styles:

```scss
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
```

- [ ] **Step 5: Add translations**

Add to all locale files:
```typescript
"Review Statistics": "复习统计",
"Total Cards": "总卡片数",
"Due Today": "今日到期",
"Today's Progress": "今日进度",
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

---

## Task 6: Final Integration Test

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 2: Verify all changes are applied**

Checklist:
- [ ] Card back shows meaning + example beautifully
- [ ] All 4 rating buttons have consistent translated labels
- [ ] Default mode dropdown shows on hover like reading mode
- [ ] Stats update when cards are imported
- [ ] Stats panel opens and displays data

---

## Notes

- Keep existing data structures unchanged (ReviewCard, ReviewSettings, etc.)
- Focus on presentation layer only
- Ensure dark/light theme compatibility using CSS variables
- Test with actual imported cards from markdown database