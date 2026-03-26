/**
 * JSON 同步数据库
 *
 * 继承 DbProvider，实现 JSON 文件与 IndexedDB 双向同步：
 * - IndexedDB 作为主存储，提供高性能查询
 * - JSON 文件作为同步桥梁，支持 Obsidian Sync
 * - 自动双向同步，保持数据一致性
 */

import { Vault, debounce } from "obsidian";
import DbProvider from "./base";
import { LocalDb } from "./local_db";
import { SyncManager } from "./sync_manager";
import { FileWatcher } from "./file_watcher";
import { createJsonDataFormat, computeHash } from "./json_serializer";
import type {
    ArticleWords, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount,
    HeatmapStats
} from "./interface";
import type Plugin from "@/plugin";

/**
 * JSON 同步数据库配置
 */
export interface JsonSyncConfig {
    /** 同步防抖延迟（毫秒） */
    syncDebounceMs: number;
    /** 文件监听防抖延迟（毫秒） */
    watchDebounceMs: number;
}

const DEFAULT_CONFIG: JsonSyncConfig = {
    syncDebounceMs: 1000,
    watchDebounceMs: 500
};

/**
 * JSON 同步数据库
 */
export class JsonSyncDb extends DbProvider {
    private plugin: Plugin;
    private jsonPath: string;
    private config: JsonSyncConfig;

    /** 本地 IndexedDB 实例 */
    private localDb: LocalDb;

    /** 同步管理器 */
    private syncManager: SyncManager;

    /** 文件监听器 */
    private fileWatcher: FileWatcher;

    /** 是否已初始化 */
    private initialized: boolean = false;

    /** 待同步标记 */
    private pendingSync: boolean = false;

    /** 同步防抖定时器 */
    private syncTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(plugin: Plugin, jsonPath: string, config?: Partial<JsonSyncConfig>) {
        super();
        this.plugin = plugin;
        this.jsonPath = jsonPath;
        this.config = { ...DEFAULT_CONFIG, ...config };

        // 初始化组件
        this.localDb = new LocalDb(plugin);
        this.syncManager = new SyncManager(
            this.localDb,
            jsonPath,
            plugin.app.vault,
            { debounceMs: this.config.syncDebounceMs }
        );
        this.fileWatcher = new FileWatcher(
            plugin.app.vault,
            jsonPath,
            this.syncManager,
            {
                debounceMs: this.config.watchDebounceMs,
                onChange: () => this.onJsonChanged()
            }
        );
    }

    /**
     * 打开数据库
     */
    async open(): Promise<void> {
        // 打开 IndexedDB
        await this.localDb.open();

        // 初始化同步
        const result = await this.syncManager.initialize();
        console.log('[JsonSyncDb] Initial sync result:', result);

        // 启动文件监听
        this.fileWatcher.start();

        this.initialized = true;
    }

    /**
     * 关闭数据库
     */
    close(): void {
        // 停止文件监听
        this.fileWatcher.stop();

        // 执行最后的同步
        if (this.pendingSync) {
            this.syncToJsonNow();
        }

        // 关闭 IndexedDB
        this.localDb.close();

        this.initialized = false;
    }

    // ========== DbProvider 接口实现 ==========

    /**
     * 在文章中寻找之前记录过的单词和词组
     */
    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        return this.localDb.getStoredWords(payload);
    }

    /**
     * 查询单个单词/词组的全部信息
     */
    async getExpression(expression: string): Promise<ExpressionInfo | null> {
        return this.localDb.getExpression(expression);
    }

    /**
     * 获取一批单词的简略信息
     */
    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        return this.localDb.getExpressionsSimple(expressions);
    }

    /**
     * 某一时间之后添加的全部单词
     */
    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        return this.localDb.getExpressionAfter(time);
    }

    /**
     * 获取全部单词的简略信息
     */
    async getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        return this.localDb.getAllExpressionSimple(ignores);
    }

    /**
     * 发送单词信息到数据库保存
     */
    async postExpression(payload: ExpressionInfo): Promise<number> {
        // 写入 IndexedDB
        const result = await this.localDb.postExpression(payload);

        // 触发同步到 JSON
        this.scheduleSyncToJson();

        return result;
    }

    /**
     * 获取所有 tag
     */
    async getTags(): Promise<string[]> {
        return this.localDb.getTags();
    }

    /**
     * 批量发送单词，全部标记为 ignore
     */
    async postIgnoreWords(payload: string[]): Promise<void> {
        await this.localDb.postIgnoreWords(payload);

        // 触发同步到 JSON
        this.scheduleSyncToJson();
    }

    /**
     * 查询一个例句是否已经记录过
     */
    async tryGetSen(text: string): Promise<Sentence | null> {
        return this.localDb.tryGetSen(text);
    }

    /**
     * 获取各类单词的个数
     */
    async getCount(): Promise<CountInfo> {
        return this.localDb.getCount();
    }

    /**
     * 获取 7 天内的统计信息
     */
    async countSeven(): Promise<WordCount[]> {
        return this.localDb.countSeven();
    }

    /**
     * 获取热力图数据
     */
    async getHeatmapData(year?: number): Promise<HeatmapStats> {
        return this.localDb.getHeatmapData();
    }

    /**
     * 销毁数据库
     */
    async destroyAll(): Promise<void> {
        await this.localDb.destroyAll();
        await this.syncManager.syncToJson();
    }

    /**
     * 导入数据库
     */
    async importDB(file: File): Promise<void> {
        // 读取文件内容
        const content = await file.text();

        try {
            const data = JSON.parse(content);

            // 验证格式
            if (data.format === 'language-learner-words' && data.data) {
                // 导入到 IndexedDB
                await this.syncManager.writeJsonFile(data);
                await this.syncManager.syncFromJson();
            } else {
                // 尝试使用 IndexedDB 原生导入
                await this.localDb.importDB(file);
            }

            // 同步到 JSON
            await this.syncManager.syncToJson();
        } catch (e) {
            console.error('[JsonSyncDb] Import failed:', e);
            throw e;
        }
    }

    /**
     * 导出数据库
     */
    async exportDB(): Promise<void> {
        await this.localDb.exportDB();
    }

    // ========== 同步相关方法 ==========

    /**
     * 安排同步到 JSON（防抖）
     */
    private scheduleSyncToJson(): void {
        this.pendingSync = true;

        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }

        this.syncTimer = setTimeout(() => {
            this.syncToJsonNow();
        }, this.config.syncDebounceMs);
    }

    /**
     * 立即同步到 JSON
     */
    private async syncToJsonNow(): Promise<void> {
        if (this.syncManager.isSyncing) return;

        try {
            const result = await this.syncManager.syncToJson();
            if (result.success) {
                console.log('[JsonSyncDb] Synced to JSON:', result.stats);
            } else {
                console.error('[JsonSyncDb] Sync failed:', result.errors);
            }
        } catch (e) {
            console.error('[JsonSyncDb] Sync error:', e);
        } finally {
            this.pendingSync = false;
            this.syncTimer = null;
        }
    }

    /**
     * JSON 文件变化时的回调
     */
    private onJsonChanged(): void {
        // 通知插件更新状态
        // 可以触发 UI 刷新等操作
        console.log('[JsonSyncDb] JSON file changed, synced to IndexedDB');
    }

    /**
     * 手动触发同步
     */
    async sync(): Promise<void> {
        await this.syncManager.sync();
    }

    /**
     * 获取本地数据库实例（用于高级操作）
     */
    getLocalDb(): LocalDb {
        return this.localDb;
    }

    /**
     * 获取同步管理器
     */
    getSyncManager(): SyncManager {
        return this.syncManager;
    }

    /**
     * 更新 JSON 文件路径
     */
    async updatePath(newPath: string): Promise<void> {
        this.jsonPath = newPath;
        this.fileWatcher.updatePath(newPath);
        await this.syncManager.syncToJson();
    }
}