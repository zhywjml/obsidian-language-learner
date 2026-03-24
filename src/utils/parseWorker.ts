/**
 * Parse Worker 管理类
 * 处理 Worker 创建、通信、错误处理和 fallback
 */

import { Phrase, Word } from "@/db/interface";

// Worker 消息类型
interface ParseRequestMessage {
    type: "PARSE_REQUEST";
    id: number;
    text: string;
    words: Word[];
    phrases: Phrase[];
}

interface ParseResponseMessage {
    type: "PARSE_RESPONSE";
    id: number;
    html: string;
    error?: string;
}

// 待处理请求
interface PendingRequest {
    resolve: (html: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export class ParseWorkerManager {
    private worker: Worker | null = null;
    private requestId = 0;
    private pendingRequests = new Map<number, PendingRequest>();
    private fallbackMode = false;
    private workerUrl: string | null = null;

    /**
     * 初始化 Worker
     */
    private async initWorker(): Promise<boolean> {
        if (this.worker) return true;
        if (this.fallbackMode) return false;

        try {
            // 尝试加载 Worker 代码
            const workerCode = await this.loadWorkerCode();
            if (!workerCode) {
                this.fallbackMode = true;
                return false;
            }

            // 使用 Blob URL 创建 Worker
            const blob = new Blob([workerCode], { type: "application/javascript" });
            this.workerUrl = URL.createObjectURL(blob);
            this.worker = new Worker(this.workerUrl);

            this.worker.onmessage = this.handleMessage.bind(this);
            this.worker.onerror = this.handleError.bind(this);

            return true;
        } catch (err) {
            console.warn("[ParseWorker] Failed to create Web Worker:", err);
            this.fallbackMode = true;
            return false;
        }
    }

    /**
     * 加载 Worker 代码
     * 尝试从多个来源加载
     */
    private async loadWorkerCode(): Promise<string | null> {
        // 方法1: 尝试动态导入 Worker 文件（如果构建工具支持）
        try {
            // @ts-ignore - 动态导入 Worker 代码
            const workerModule = await import("@/workers/parse.worker.ts");
            if (workerModule && workerModule.default) {
                return workerModule.default;
            }
        } catch {
            // 忽略错误，尝试其他方法
        }

        // 方法2: 使用 fetch 加载 Worker 文件（需要插件目录中的 worker 文件）
        try {
            // 在 Obsidian 环境中，尝试从插件目录加载
            const pluginDir = this.getPluginDir();
            if (pluginDir) {
                const response = await fetch(`${pluginDir}/parse.worker.js`);
                if (response.ok) {
                    return await response.text();
                }
            }
        } catch {
            // 忽略错误
        }

        // 方法3: 返回 null，使用 fallback
        return null;
    }

    /**
     * 获取插件目录
     */
    private getPluginDir(): string | null {
        try {
            // @ts-ignore - Obsidian API
            const vault = window.app?.vault;
            if (vault && vault.adapter) {
                // 尝试多种方式获取路径
                // @ts-ignore
                const basePath = vault.adapter.getBasePath?.() || vault.adapter.basePath;
                if (basePath) {
                    // 构造插件目录路径
                    const pluginDir = `${basePath}/.obsidian/plugins/obsidian-language-learner`;
                    return pluginDir;
                }
            }
        } catch {
            // 忽略错误
        }
        return null;
    }

    /**
     * 处理 Worker 消息
     */
    private handleMessage(e: MessageEvent<ParseResponseMessage>) {
        const { id, html, error } = e.data;
        const request = this.pendingRequests.get(id);
        if (!request) return;

        this.pendingRequests.delete(id);
        clearTimeout(request.timer);

        if (error) {
            request.reject(new Error(error));
        } else {
            request.resolve(html);
        }
    }

    /**
     * 处理 Worker 错误
     */
    private handleError(err: ErrorEvent) {
        console.error("[ParseWorker] Worker error:", err);

        // 所有待处理请求都 reject
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timer);
            request.reject(new Error("Worker error: " + err.message));
        }
        this.pendingRequests.clear();

        // 切换到 fallback 模式
        this.terminate();
        this.fallbackMode = true;
    }

    /**
     * 发送解析请求
     */
    async parse(text: string, words: Word[], phrases: Phrase[]): Promise<string> {
        // 短文本直接使用主线程解析（避免 Worker 开销）
        if (text.length < 1000) {
            return this.parseInMainThread(text, words, phrases);
        }

        // 尝试使用 Worker
        const workerReady = await this.initWorker();
        if (workerReady) {
            try {
                return await this.parseWithWorker(text, words, phrases);
            } catch (err) {
                console.warn("[ParseWorker] Worker parse failed, falling back:", err);
                // 切换到 fallback 模式
                this.fallbackMode = true;
            }
        }

        // 主线程解析 fallback
        return this.parseInMainThread(text, words, phrases);
    }

    /**
     * 使用 Worker 解析
     */
    private async parseWithWorker(
        text: string,
        words: Word[],
        phrases: Phrase[]
    ): Promise<string> {
        const id = ++this.requestId;

        return new Promise((resolve, reject) => {
            // 设置超时
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error("Worker parse timeout"));
            }, 10000); // 10秒超时

            this.pendingRequests.set(id, { resolve, reject, timer });

            // 发送请求到 Worker
            const message: ParseRequestMessage = {
                type: "PARSE_REQUEST",
                id,
                text,
                words,
                phrases
            };
            this.worker!.postMessage(message);
        });
    }

    /**
     * 主线程解析（fallback）
     * 简化版实现，只支持基本功能
     */
    private parseInMainThread(
        text: string,
        words: Word[],
        phrases: Phrase[]
    ): string {
        // 创建单词状态查找表
        const wordStatusMap = new Map<string, number>();
        for (const word of words) {
            wordStatusMap.set(word.text.toLowerCase(), word.status);
        }

        // 单词状态映射
        const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];

        // HTML 转义
        const escapeHtml = (str: string): string => {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        // 按段落分割
        const paragraphs = text.split(/\n\n+/);
        const result: string[] = [];

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;

            // 处理 Markdown 图片
            const imgMatch = paragraph.match(/^!\[(.*?)\]\((.*?)\)$/);
            if (imgMatch) {
                const alt = escapeHtml(imgMatch[1]);
                const src = escapeHtml(imgMatch[2]);
                result.push(`<div style="text-align:center"><div style="display:inline-block"><img alt="${alt}" src="${src}"></div></div>`);
                continue;
            }

            // 处理标题
            const headerMatch = paragraph.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                const content = headerMatch[2];
                // 简单分词处理
                const tokens = content.split(/(\s+)/);
                const wrapped = tokens.map(token => {
                    if (/^\s+$/.test(token)) return token;
                    const lower = token.toLowerCase();
                    if (wordStatusMap.has(lower)) {
                        const status = STATUS_MAP[wordStatusMap.get(lower)!];
                        return `<span class="word ${status}">${escapeHtml(token)}</span>`;
                    }
                    if (/[0-9\u4e00-\u9fa5]/.test(token)) {
                        return `<span class="other">${escapeHtml(token)}</span>`;
                    }
                    return `<span class="word new">${escapeHtml(token)}</span>`;
                });
                result.push(`<h${level}><span class="stns">${wrapped.join("")}</span></h${level}>`);
                continue;
            }

            // 普通段落
            const tokens = paragraph.split(/(\s+)/);
            const wrapped = tokens.map(token => {
                if (/^\s+$/.test(token)) return token;
                const lower = token.toLowerCase();
                if (wordStatusMap.has(lower)) {
                    const status = STATUS_MAP[wordStatusMap.get(lower)!];
                    return `<span class="word ${status}">${escapeHtml(token)}</span>`;
                }
                if (/[0-9\u4e00-\u9fa5]/.test(token)) {
                    return `<span class="other">${escapeHtml(token)}</span>`;
                }
                return `<span class="word new">${escapeHtml(token)}</span>`;
            });
            result.push(`<p>${wrapped.join("")}</p>`);
        }

        return result.join("");
    }

    /**
     * 销毁 Worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.workerUrl) {
            URL.revokeObjectURL(this.workerUrl);
            this.workerUrl = null;
        }
        // 清理待处理请求
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timer);
            request.reject(new Error("Worker terminated"));
        }
        this.pendingRequests.clear();
    }
}

// 单例实例
let workerManager: ParseWorkerManager | null = null;

/**
 * 获取 Worker 管理器实例
 */
export function getParseWorker(): ParseWorkerManager {
    if (!workerManager) {
        workerManager = new ParseWorkerManager();
    }
    return workerManager;
}

/**
 * 释放 Worker 资源
 */
export function disposeParseWorker() {
    if (workerManager) {
        workerManager.terminate();
        workerManager = null;
    }
}
