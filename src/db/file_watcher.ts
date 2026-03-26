/**
 * 文件监听器
 *
 * 监听 JSON 文件变化并触发同步：
 * - 使用 Obsidian Vault 事件系统
 * - 防止同步循环（通过哈希检查）
 * - 防抖处理避免频繁触发
 */

import { EventRef, TFile, Vault, debounce } from "obsidian";
import { SyncManager } from "./sync_manager";

/**
 * 文件监听器配置
 */
export interface FileWatcherConfig {
    /** 防抖延迟（毫秒） */
    debounceMs: number;
    /** 变化时的回调 */
    onChange?: () => void;
}

const DEFAULT_CONFIG: FileWatcherConfig = {
    debounceMs: 500
};

/**
 * 文件监听器
 */
export class FileWatcher {
    private vault: Vault;
    private jsonPath: string;
    private syncManager: SyncManager;
    private config: FileWatcherConfig;

    /** 事件引用，用于取消监听 */
    private modifyEventRef: EventRef | null = null;

    /** 是否正在监听 */
    private isWatching: boolean = false;

    constructor(
        vault: Vault,
        jsonPath: string,
        syncManager: SyncManager,
        config?: Partial<FileWatcherConfig>
    ) {
        this.vault = vault;
        this.jsonPath = jsonPath;
        this.syncManager = syncManager;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * 开始监听文件变化
     */
    start(): void {
        if (this.isWatching) return;

        // 使用防抖处理文件修改事件
        const debouncedHandler = debounce(
            this.onFileModified.bind(this),
            this.config.debounceMs,
            true
        );

        // 注册文件修改事件
        this.modifyEventRef = this.vault.on('modify', (file) => {
            if (file instanceof TFile && file.path === this.jsonPath) {
                debouncedHandler(file);
            }
        });

        this.isWatching = true;
        console.log(`[FileWatcher] Started watching ${this.jsonPath}`);
    }

    /**
     * 停止监听
     */
    stop(): void {
        if (!this.isWatching) return;

        if (this.modifyEventRef) {
            this.vault.offref(this.modifyEventRef);
            this.modifyEventRef = null;
        }

        this.isWatching = false;
        console.log(`[FileWatcher] Stopped watching ${this.jsonPath}`);
    }

    /**
     * 文件修改处理
     */
    private async onFileModified(file: TFile): Promise<void> {
        // 检查是否正在同步中（防止循环）
        if (this.syncManager.isSyncing) {
            console.log('[FileWatcher] Skipping sync - already in progress');
            return;
        }

        console.log(`[FileWatcher] File modified: ${file.path}`);

        try {
            // 执行 JSON → IndexedDB 同步
            const result = await this.syncManager.syncFromJson();

            if (result.success) {
                console.log('[FileWatcher] Sync completed:', result.direction, result.stats);

                // 触发回调
                if (this.config.onChange) {
                    this.config.onChange();
                }
            } else {
                console.error('[FileWatcher] Sync failed:', result.errors);
            }
        } catch (e) {
            console.error('[FileWatcher] Sync error:', e);
        }
    }

    /**
     * 检查是否正在监听
     */
    isRunning(): boolean {
        return this.isWatching;
    }

    /**
     * 更新监听的文件路径
     */
    updatePath(newPath: string): void {
        const wasWatching = this.isWatching;
        this.stop();
        this.jsonPath = newPath;
        if (wasWatching) {
            this.start();
        }
    }
}