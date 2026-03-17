<template>
    <div id="langr-anki-export">
        <div class="anki-header">
            <h3>{{ t("Export to Anki") }}</h3>
            <button class="refresh-btn" @click="refreshData">
                {{ t("Refresh") }}
            </button>
        </div>

        <div v-if="!ankiEnabled" class="anki-disabled">
            <p>{{ t("AnkiConnect is not enabled") }}</p>
            <p class="hint">{{ t("Enable AnkiConnect in settings first") }}</p>
        </div>

        <div v-else class="anki-content">
            <!-- Connection status -->
            <div class="connection-status" :class="{ connected: isConnected }">
                <span class="status-icon">{{ isConnected ? "✓" : "✗" }}</span>
                <span>{{ isConnected ? t("Connected to Anki") : t("Not connected") }}</span>
                <button v-if="!isConnected" class="retry-btn" @click="testConnection">
                    {{ t("Retry") }}
                </button>
            </div>

            <!-- Export options -->
            <div v-if="isConnected" class="export-options">
                <div class="option-row">
                    <label>{{ t("Deck") }}:</label>
                    <select v-model="selectedDeck" @change="onDeckChange">
                        <option v-for="deck in decks" :key="deck" :value="deck">{{ deck }}</option>
                    </select>
                </div>

                <div class="option-row">
                    <label>{{ t("Model") }}:</label>
                    <select v-model="selectedModel" @change="onModelChange">
                        <option v-for="model in models" :key="model" :value="model">{{ model }}</option>
                    </select>
                </div>

                <div class="option-row">
                    <label>{{ t("Filter") }}:</label>
                    <select v-model="statusFilter" @change="filterWords">
                        <option value="-1">{{ t("All") }}</option>
                        <option value="1">{{ t("Learning") }}</option>
                        <option value="2">{{ t("Familiar") }}</option>
                        <option value="3">{{ t("Known") }}</option>
                        <option value="4">{{ t("Learned") }}</option>
                    </select>
                </div>
            </div>

            <!-- Word list -->
            <div v-if="isConnected" class="word-list-container">
                <div class="word-list-header">
                    <span class="word-count">{{ filteredWords.length }} {{ t("words") }}</span>
                    <label class="select-all">
                        <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
                        {{ t("Select All") }}
                    </label>
                </div>

                <div class="word-list">
                    <div
                        v-for="word in paginatedWords"
                        :key="word.expression"
                        class="word-item"
                        :class="{ selected: selectedWords.has(word.expression) }"
                    >
                        <label class="word-checkbox">
                            <input
                                type="checkbox"
                                :checked="selectedWords.has(word.expression)"
                                @change="toggleWord(word.expression)"
                            />
                        </label>
                        <div class="word-info">
                            <div class="word-expression">{{ word.expression }}</div>
                            <div class="word-meaning">{{ word.meaning }}</div>
                            <div class="word-tags">
                                <span v-for="tag in word.tags" :key="tag" class="tag">{{ tag }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="pagination">
                    <button :disabled="currentPage === 1" @click="currentPage--">
                        {{ t("Previous") }}
                    </button>
                    <span>{{ currentPage }} / {{ totalPages }}</span>
                    <button :disabled="currentPage >= totalPages" @click="currentPage++">
                        {{ t("Next") }}
                    </button>
                </div>
            </div>

            <!-- Export action -->
            <div v-if="isConnected && selectedWords.size > 0" class="export-action">
                <button class="export-btn" @click="exportToAnki" :disabled="exporting">
                    {{ exporting ? t("Exporting...") : t("Export") }} ({{ selectedWords.size }})
                </button>
            </div>

            <!-- Result message -->
            <div v-if="exportResult" class="export-result" :class="{ success: exportResult.success, error: !exportResult.success }">
                {{ exportResult.message }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { t } from "@/lang/helper";
import type { ExpressionInfoSimple } from "@/db/interface";
import { AnkiConnect } from "@/anki/anki";
import { getCurrentInstance } from "vue";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin;

// Anki connection
const ankiEnabled = ref(false);
const isConnected = ref(false);
let anki: AnkiConnect | null = null;

// Options
const decks = ref<string[]>([]);
const models = ref<string[]>([]);
const modelFields = ref<string[]>([]);  // 当前选中模板的字段名
const selectedDeck = ref("");
const selectedModel = ref("");
const statusFilter = ref("-1");

// Words data
const allWords = ref<ExpressionInfoSimple[]>([]);
const filteredWords = ref<ExpressionInfoSimple[]>([]);

// Selection
const selectedWords = reactive(new Set<string>());
const selectAll = ref(false);

// Pagination
const currentPage = ref(1);
const pageSize = 20;

// Export state
const exporting = ref(false);
const exportResult = ref<{ success: boolean; message: string } | null>(null);

// Computed
const totalPages = computed(() => Math.ceil(filteredWords.value.length / pageSize) || 1);
const paginatedWords = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return filteredWords.value.slice(start, start + pageSize);
});

// Initialize
onMounted(async () => {
    await loadSettings();
    if (ankiEnabled.value) {
        await testConnection();
        if (isConnected.value && selectedModel.value) {
            // Load field names for default model
            try {
                modelFields.value = await anki.getModelFieldNames(selectedModel.value);
                console.log("Initial model fields:", modelFields.value);
            } catch (e) {
                console.error("Failed to get initial model fields:", e);
            }
        }
        await refreshData();
    }
});

// Watch for page changes
watch(currentPage, () => {
    selectAll.value = false;
});

async function loadSettings() {
    ankiEnabled.value = plugin.settings.anki_enabled;
    selectedDeck.value = plugin.settings.anki_deck;
    selectedModel.value = plugin.settings.anki_model;

    anki = new AnkiConnect(
        plugin.settings.anki_host,
        plugin.settings.anki_port,
        plugin.settings.anki_api_key
    );
}

async function testConnection() {
    if (!anki) return;
    try {
        isConnected.value = await anki.connect();
        if (isConnected.value) {
            await loadDecksAndModels();
        }
    } catch (e) {
        isConnected.value = false;
        console.error("AnkiConnect connection failed:", e);
    }
}

async function loadDecksAndModels() {
    if (!anki) return;
    try {
        decks.value = await anki.getDeckNames();
        models.value = await anki.getModelNames();

        // Ensure default deck exists
        if (selectedDeck.value && !decks.value.includes(selectedDeck.value)) {
            await anki.ensureDeckExists(selectedDeck.value);
            decks.value = await anki.getDeckNames();
        }
    } catch (e) {
        console.error("Failed to load decks/models:", e);
    }
}

async function refreshData() {
    // Re-test Anki connection
    await testConnection();

    // Reload word data
    try {
        allWords.value = await plugin.db.getAllExpressionSimple(true);
        // Filter out ignored words (status = 0)
        allWords.value = allWords.value.filter(w => w.status !== 0);
        filterWords();
    } catch (e) {
        console.error("Failed to load words:", e);
    }
}

function filterWords() {
    const status = parseInt(statusFilter.value);
    if (status === -1) {
        filteredWords.value = allWords.value;
    } else {
        filteredWords.value = allWords.value.filter(w => w.status === status);
    }
    currentPage.value = 1;
    selectedWords.clear();
    selectAll.value = false;
}

function onDeckChange() {
    // Save selection
    plugin.settings.anki_deck = selectedDeck.value;
    plugin.saveSettings();
}

async function onModelChange() {
    plugin.settings.anki_model = selectedModel.value;
    plugin.saveSettings();
    // Load field names for selected model
    if (anki && selectedModel.value) {
        try {
            modelFields.value = await anki.getModelFieldNames(selectedModel.value);
            console.log("Model fields:", modelFields.value);
        } catch (e) {
            console.error("Failed to get model fields:", e);
            modelFields.value = [];
        }
    }
}

function toggleWord(expression: string) {
    if (selectedWords.has(expression)) {
        selectedWords.delete(expression);
    } else {
        selectedWords.add(expression);
    }
    updateSelectAll();
}

function toggleSelectAll() {
    if (selectAll.value) {
        paginatedWords.value.forEach(w => selectedWords.add(w.expression));
    } else {
        paginatedWords.value.forEach(w => selectedWords.delete(w.expression));
    }
}

function updateSelectAll() {
    selectAll.value = paginatedWords.value.length > 0 &&
        paginatedWords.value.every(w => selectedWords.has(w.expression));
}

async function exportToAnki() {
    if (!anki || selectedWords.size === 0) return;

    exporting.value = true;
    exportResult.value = null;

    try {
        // Ensure deck exists
        await anki.ensureDeckExists(selectedDeck.value);

        let successCount = 0;
        let errorCount = 0;

        for (const expression of selectedWords) {
            const word = allWords.value.find(w => w.expression === expression);
            if (!word) continue;

            // Get full word info with sentences
            const fullWord = await plugin.db.getExpression(expression);
            if (!fullWord) continue;

            // Build card content
            const sentences = fullWord.sentences
                .map(s => `<br><i>${s.text}</i><br>${s.trans || ""}`)
                .join("");

            // Use dynamic field names from the selected model
            const fields: { [key: string]: string } = {};
            if (modelFields.value.length >= 2) {
                // Use first field for expression, second for meaning+sentences
                fields[modelFields.value[0]] = fullWord.expression;
                fields[modelFields.value[1]] = `${fullWord.meaning}${sentences}`;
            } else if (modelFields.value.length === 1) {
                // Single field - put everything in it
                fields[modelFields.value[0]] = `${fullWord.expression}\n${fullWord.meaning}${sentences}`;
            } else {
                // Fallback to default field names
                fields["Front"] = fullWord.expression;
                fields["Back"] = `${fullWord.meaning}${sentences}`;
            }

            const note = {
                deckName: selectedDeck.value,
                modelName: selectedModel.value,
                fields,
                tags: fullWord.tags || [],
            };

            try {
                await anki.addNote(note);
                successCount++;
            } catch (e) {
                console.error(`Failed to add "${expression}":`, e);
                errorCount++;
            }
        }

        if (errorCount === 0) {
            exportResult.value = {
                success: true,
                message: t("Successfully exported") + ` ${successCount} ${t("words")}`,
            };
        } else {
            exportResult.value = {
                success: false,
                message: t("Exported") + ` ${successCount}, ${t("Failed")} ${errorCount}`,
            };
        }

        // Clear selection after export
        selectedWords.clear();
        selectAll.value = false;

    } catch (e) {
        exportResult.value = {
            success: false,
            message: t("Export failed") + ": " + (e as Error).message,
        };
    } finally {
        exporting.value = false;
    }
}
</script>

<style scoped>
#langr-anki-export {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
}

.anki-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.anki-header h3 {
    margin: 0;
}

.refresh-btn {
    padding: 4px 12px;
    cursor: pointer;
}

.anki-disabled {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
}

.anki-disabled .hint {
    font-size: 12px;
    margin-top: 8px;
}

.connection-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    background: var(--background-secondary);
}

.connection-status.connected {
    color: var(--text-success);
}

.status-icon {
    font-weight: bold;
}

.retry-btn {
    margin-left: auto;
    padding: 2px 8px;
    cursor: pointer;
}

.export-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 4px;
}

.option-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.option-row label {
    min-width: 60px;
}

.option-row select {
    flex: 1;
    padding: 4px;
}

.word-list-container {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
}

.word-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--border-color);
}

.word-count {
    font-size: 12px;
    color: var(--text-muted);
}

.select-all {
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
}

.word-list {
    max-height: 400px;
    overflow-y: auto;
}

.word-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
}

.word-item:last-child {
    border-bottom: none;
}

.word-item.selected {
    background: var(--background-primary);
}

.word-checkbox {
    padding-top: 4px;
}

.word-info {
    flex: 1;
    min-width: 0;
}

.word-expression {
    font-weight: 600;
    margin-bottom: 4px;
}

.word-meaning {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.word-tags {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
}

.tag {
    font-size: 10px;
    padding: 1px 6px;
    background: var(--background-secondary);
    border-radius: 2px;
}

.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: var(--background-secondary);
    border-top: 1px solid var(--border-color);
}

.pagination button {
    padding: 4px 12px;
    cursor: pointer;
}

.pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.export-action {
    margin-top: 16px;
    text-align: center;
}

.export-btn {
    padding: 8px 24px;
    cursor: pointer;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
}

.export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.export-result {
    margin-top: 16px;
    padding: 8px 12px;
    border-radius: 4px;
    text-align: center;
}

.export-result.success {
    background: var(--background-success);
    color: var(--text-success);
}

.export-result.error {
    background: var(--background-danger);
    color: var(--text-danger);
}
</style>