/**
 * 同步管理器
 *
 * 负责 JSON 文件与 IndexedDB 之间的双向同步：
 * - JSON → IndexedDB: 当文件被 Obsidian Sync 更新时
 * - IndexedDB → JSON: 当本地数据变更时
 * - 双向合并: 启动时检测并合并
 */

import { TFile, Vault, normalizePath } from "obsidian";
import { LocalDb } from "./local_db";
import {
    JsonDataFormat,
    JsonData,
    JsonExpression,
    JsonSentence,
    SyncResult,
    JSON_FORMAT_VERSION,
    JSON_FORMAT_IDENTIFIER
} from "./json_format";
import {
    serializeExpression,
    deserializeExpression,
    serializeSentence,
    deserializeSentence,
    computeHash,
    createJsonDataFormat,
    validateJsonFormat,
    mergeExpressions,
    mergeSentences
} from "./json_serializer";

/**
 * 同步配置
 */
export interface SyncConfig {
    /** 防抖延迟（毫秒） */
    debounceMs: number;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
    debounceMs: 1000
};

/**
 * 同步管理器
 */
export class SyncManager {
    private localDb: LocalDb;
    private jsonPath: string;
    private vault: Vault;
    private config: SyncConfig;

    /** 上次同步的数据哈希 */
    private lastSyncHash: string = '';

    /** 是否正在同步中 */
    isSyncing: boolean = false;

    constructor(
        localDb: LocalDb,
        jsonPath: string,
        vault: Vault,
        config?: Partial<SyncConfig>
    ) {
        this.localDb = localDb;
        this.jsonPath = normalizePath(jsonPath);
        this.vault = vault;
        this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    }

    /**
     * 初始化同步
     * 根据现有数据状态决定同步方向
     */
    async initialize(): Promise<SyncResult> {
        const jsonExists = await this.checkJsonExists();
        const idbHasData = await this.checkIdbHasData();

        if (!jsonExists && !idbHasData) {
            // 两者都为空，创建新的 JSON 文件
            return this.createNewJsonFile();
        } else if (!jsonExists && idbHasData) {
            // IndexedDB 有数据，导出到 JSON
            return this.syncToJson();
        } else if (jsonExists && !idbHasData) {
            // JSON 有数据，导入到 IndexedDB
            return this.syncFromJson();
        } else {
            // 两者都有数据，执行双向同步
            return this.sync();
        }
    }

    /**
     * JSON → IndexedDB 同步
     */
    async syncFromJson(): Promise<SyncResult> {
        if (this.isSyncing) {
            return { success: false, direction: 'none', stats: this.emptyStats(), errors: ['Sync in progress'] };
        }

        this.isSyncing = true;
        const stats = this.emptyStats();

        try {
            const jsonData = await this.readJsonFile();
            if (!jsonData) {
                return { success: false, direction: 'none', stats, errors: ['JSON file not found or invalid'] };
            }

            // 检查哈希，避免重复同步
            const newHash = computeHash(jsonData.data);
            if (newHash === this.lastSyncHash) {
                return { success: true, direction: 'none', stats, errors: [] };
            }

            // 导入表达式到 IndexedDB
            const result = await this.importExpressionsToIdb(jsonData.data, stats);

            this.lastSyncHash = newHash;
            return { success: true, direction: 'json-to-idb', stats, errors: [] };
        } catch (e) {
            console.error('[SyncManager] syncFromJson error:', e);
            return { success: false, direction: 'json-to-idb', stats, errors: [String(e)] };
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * IndexedDB → JSON 同步
     */
    async syncToJson(): Promise<SyncResult> {
        if (this.isSyncing) {
            return { success: false, direction: 'none', stats: this.emptyStats(), errors: ['Sync in progress'] };
        }

        this.isSyncing = true;
        const stats = this.emptyStats();

        try {
            // 从 IndexedDB 导出所有数据
            const jsonData = await this.exportFromIdb(stats);

            // 写入 JSON 文件
            await this.writeJsonFile(jsonData);

            this.lastSyncHash = computeHash(jsonData.data);
            return { success: true, direction: 'idb-to-json', stats, errors: [] };
        } catch (e) {
            console.error('[SyncManager] syncToJson error:', e);
            return { success: false, direction: 'idb-to-json', stats, errors: [String(e)] };
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * 双向同步（合并）
     */
    async sync(): Promise<SyncResult> {
        if (this.isSyncing) {
            return { success: false, direction: 'none', stats: this.emptyStats(), errors: ['Sync in progress'] };
        }

        this.isSyncing = true;
        const stats = this.emptyStats();

        try {
            // 读取 JSON 数据
            const jsonData = await this.readJsonFile();
            const jsonHash = jsonData ? computeHash(jsonData.data) : '';

            // 如果哈希相同，无需同步
            if (jsonHash === this.lastSyncHash) {
                return { success: true, direction: 'none', stats, errors: [] };
            }

            // 从 IndexedDB 导出数据
            const idbData = await this.exportFromIdb(stats);

            // 合并数据
            const mergedExpressions = mergeExpressions(
                idbData.data.expressions,
                jsonData?.data.expressions || []
            );
            const mergedSentences = mergeSentences(
                idbData.data.sentences,
                jsonData?.data.sentences || []
            );

            // 重新分配句子 ID
            const sentenceIdMap = new Map<string, number>();
            const reassignedSentences = mergedSentences.map((sen, index) => {
                const newId = index + 1;
                sentenceIdMap.set(sen.text, newId);
                return { ...sen, id: newId };
            });

            // 更新表达式中的句子 ID
            const finalExpressions = mergedExpressions.map(expr => ({
                ...expr,
                sentenceIds: expr.sentenceIds.map(id => {
                    // 根据句子文本查找新 ID
                    const sen = mergedSentences.find(s => s.id === id);
                    return sen ? sentenceIdMap.get(sen.text) || id : id;
                })
            }));

            stats.expressionsProcessed = finalExpressions.length;
            stats.sentencesProcessed = reassignedSentences.length;

            // 写入合并后的数据
            const mergedData = createJsonDataFormat(finalExpressions, reassignedSentences);
            await this.writeJsonFile(mergedData);

            // 同步回 IndexedDB
            await this.importExpressionsToIdb(mergedData.data, stats);

            this.lastSyncHash = computeHash(mergedData.data);
            return { success: true, direction: 'merge', stats, errors: [] };
        } catch (e) {
            console.error('[SyncManager] sync error:', e);
            return { success: false, direction: 'merge', stats, errors: [String(e)] };
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * 检查 JSON 文件是否存在
     */
    private async checkJsonExists(): Promise<boolean> {
        const file = this.vault.getAbstractFileByPath(this.jsonPath);
        return file instanceof TFile;
    }

    /**
     * 检查 IndexedDB 是否有数据
     */
    private async checkIdbHasData(): Promise<boolean> {
        const count = await this.localDb.idb.expressions.count();
        return count > 0;
    }

    /**
     * 创建新的 JSON 文件
     */
    private async createNewJsonFile(): Promise<SyncResult> {
        const emptyData = createJsonDataFormat([], []);
        await this.writeJsonFile(emptyData);
        this.lastSyncHash = computeHash(emptyData.data);

        return {
            success: true,
            direction: 'idb-to-json',
            stats: this.emptyStats(),
            errors: []
        };
    }

    /**
     * 读取 JSON 文件
     */
    private async readJsonFile(): Promise<JsonDataFormat | null> {
        const file = this.vault.getAbstractFileByPath(this.jsonPath);
        if (!(file instanceof TFile)) return null;

        try {
            const content = await this.vault.read(file);
            const data = JSON.parse(content);

            if (!validateJsonFormat(data)) {
                console.error('[SyncManager] Invalid JSON format');
                return null;
            }

            return data;
        } catch (e) {
            console.error('[SyncManager] Failed to read JSON file:', e);
            return null;
        }
    }

    /**
     * 写入 JSON 文件
     */
    async writeJsonFile(data: JsonDataFormat): Promise<void> {
        const content = JSON.stringify(data, null, 2);
        const file = this.vault.getAbstractFileByPath(this.jsonPath);

        // 确保目录存在
        const parentPath = this.jsonPath.substring(0, this.jsonPath.lastIndexOf('/'));
        if (parentPath) {
            await this.ensureFolder(parentPath);
        }

        if (file instanceof TFile) {
            await this.vault.modify(file, content);
        } else {
            await this.vault.create(this.jsonPath, content);
        }
    }

    /**
     * 确保文件夹存在
     */
    private async ensureFolder(path: string): Promise<void> {
        const folder = this.vault.getAbstractFileByPath(path);
        if (folder) return;

        try {
            await this.vault.createFolder(path);
        } catch (e) {
            // 文件夹可能已存在，忽略
        }
    }

    /**
     * 从 IndexedDB 导出数据
     */
    private async exportFromIdb(stats: SyncResult['stats']): Promise<JsonDataFormat> {
        const expressions: JsonExpression[] = [];
        const sentences: JsonSentence[] = [];
        const sentenceIdMap = new Map<number, number>();

        // 导出所有句子
        const allSentences = await this.localDb.idb.sentences.toArray();
        for (const sen of allSentences) {
            const newId = sentences.length + 1;
            sentenceIdMap.set(sen.id!, newId);
            sentences.push(serializeSentence(sen, newId));
        }
        stats.sentencesProcessed = sentences.length;

        // 导出所有表达式
        const allExpressions = await this.localDb.idb.expressions.toArray();
        for (const expr of allExpressions) {
            const jsonExpr = serializeExpression(expr, expressions.length + 1);
            // 更新句子 ID
            jsonExpr.sentenceIds = [...expr.sentences]
                .map(id => sentenceIdMap.get(id) || id);
            expressions.push(jsonExpr);
        }
        stats.expressionsProcessed = expressions.length;

        return createJsonDataFormat(expressions, sentences);
    }

    /**
     * 导入表达式到 IndexedDB
     */
    private async importExpressionsToIdb(data: JsonData, stats: SyncResult['stats']): Promise<void> {
        // 先导入句子
        const sentenceIdMap = new Map<number, number>();
        for (const jsonSen of data.sentences) {
            const sentence = deserializeSentence(jsonSen);
            let existing = await this.localDb.idb.sentences
                .where('text').equals(sentence.text).first();

            if (existing) {
                sentenceIdMap.set(jsonSen.id, existing.id!);
            } else {
                const newId = await this.localDb.idb.sentences.add(sentence);
                sentenceIdMap.set(jsonSen.id, newId);
            }
        }
        stats.sentencesProcessed = data.sentences.length;

        // 再导入表达式
        for (const jsonExpr of data.expressions) {
            const existing = await this.localDb.idb.expressions
                .where('expression').equals(jsonExpr.expression).first();

            // 转换句子 ID
            const sentenceIds = jsonExpr.sentenceIds.map(id => sentenceIdMap.get(id) || id);

            // 创建 JSON 表达式副本，更新句子 ID
            const jsonWithNewIds = { ...jsonExpr, sentenceIds };
            const expr = deserializeExpression(jsonWithNewIds);

            if (existing) {
                // 检查是否需要更新
                if (jsonExpr.date > existing.date) {
                    await this.localDb.idb.expressions.update(existing.id!, expr);
                    stats.expressionsUpdated++;
                }
            } else {
                await this.localDb.idb.expressions.add(expr);
                stats.expressionsAdded++;
            }
        }
        stats.expressionsProcessed = data.expressions.length;
    }

    /**
     * 空统计对象
     */
    private emptyStats(): SyncResult['stats'] {
        return {
            expressionsProcessed: 0,
            sentencesProcessed: 0,
            expressionsAdded: 0,
            expressionsUpdated: 0,
            conflictsFound: 0,
            conflictsResolved: 0
        };
    }

    /**
     * 获取当前哈希值
     */
    getLastSyncHash(): string {
        return this.lastSyncHash;
    }

    /**
     * 更新哈希值
     */
    updateHash(hash: string): void {
        this.lastSyncHash = hash;
    }
}