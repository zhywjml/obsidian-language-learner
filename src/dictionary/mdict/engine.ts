/**
 * MDict 词典解析引擎
 *
 * 使用 js-mdict 库解析 .mdx 文件
 */

import { MDX, Mdict, KeyWordItem } from "js-mdict";
import { Notice, TFile, Platform } from "obsidian";
import { MdictSearchResult, MdictSuggestion, MdictInfo, MdictConfig } from "./types";

/**
 * MDict 引擎类
 * 管理单个或多个 MDict 词典
 */
export class MdictEngine {
    private mdx: MDX | null = null;
    private basePath: string;
    private currentPath: string | null = null;

    constructor(basePath: string) {
        this.basePath = basePath;
    }

    /**
     * 加载 MDX 词典文件
     * @param relativePath 相对于 vault 根目录的路径
     */
    async loadDictionary(relativePath: string): Promise<boolean> {
        try {
            // 关闭之前的词典
            this.close();

            // 构建完整路径
            // 注意：在 Windows 上路径格式需要处理
            const fullPath = this.getFullPath(relativePath);

            // 检查是否在桌面端
            if (!Platform.isDesktopApp) {
                new Notice("MDict 词典仅支持桌面端");
                return false;
            }

            // 创建 MDX 实例
            this.mdx = new MDX(fullPath, {
                resort: true,        // 启用重排序以处理排序问题
                isStripKey: true,    // 去除词条中的特殊字符
                isCaseSensitive: false, // 不区分大小写
            });

            this.currentPath = relativePath;
            return true;
        } catch (error) {
            console.error("Failed to load MDict dictionary:", error);
            new Notice(`加载词典失败: ${error.message}`);
            this.mdx = null;
            this.currentPath = null;
            return false;
        }
    }

    /**
     * 获取完整的文件系统路径
     */
    private getFullPath(relativePath: string): string {
        // 标准化路径
        let path = relativePath.replace(/\\/g, "/");
        // 移除开头的斜杠
        if (path.startsWith("/")) {
            path = path.slice(1);
        }
        return `${this.basePath}/${path}`;
    }

    /**
     * 查询单词
     * @param word 要查询的单词
     */
    search(word: string): MdictSearchResult {
        if (!this.mdx) {
            return {
                word,
                definition: null,
                found: false
            };
        }

        try {
            const result = this.mdx.lookup(word);
            return {
                word: result.keyText || word,
                definition: result.definition,
                found: result.definition !== null
            };
        } catch (error) {
            console.error("MDict search error:", error);
            return {
                word,
                definition: null,
                found: false
            };
        }
    }

    /**
     * 前缀匹配查询
     * @param prefix 前缀
     * @param limit 返回结果数量限制
     */
    prefix(prefix: string, limit: number = 20): MdictSuggestion[] {
        if (!this.mdx) {
            return [];
        }

        try {
            const results = this.mdx.prefix(prefix);
            return results.slice(0, limit).map((item: KeyWordItem) => ({
                keyText: item.keyText,
                recordStartOffset: item.recordStartOffset,
                recordEndOffset: item.recordEndOffset
            }));
        } catch (error) {
            console.error("MDict prefix search error:", error);
            return [];
        }
    }

    /**
     * 模糊匹配/建议
     * @param word 搜索单词
     * @param fuzzySize 返回数量
     * @param edGap 编辑距离
     */
    suggest(word: string, fuzzySize: number = 10, edGap: number = 3): MdictSuggestion[] {
        if (!this.mdx) {
            return [];
        }

        try {
            const results = this.mdx.fuzzy_search(word, fuzzySize, edGap);
            return results.map((item) => ({
                keyText: item.keyText,
                recordStartOffset: item.recordStartOffset,
                recordEndOffset: item.recordEndOffset
            }));
        } catch (error) {
            console.error("MDict suggest error:", error);
            return [];
        }
    }

    /**
     * 关联查询（类似搜索引擎的联想）
     * @param phrase 查询短语
     */
    associate(phrase: string): MdictSuggestion[] {
        if (!this.mdx) {
            return [];
        }

        try {
            const results = this.mdx.associate(phrase);
            return results.slice(0, 20).map((item: KeyWordItem) => ({
                keyText: item.keyText,
                recordStartOffset: item.recordStartOffset,
                recordEndOffset: item.recordEndOffset
            }));
        } catch (error) {
            console.error("MDict associate search error:", error);
            return [];
        }
    }

    /**
     * 获取词典信息
     */
    getInfo(): MdictInfo {
        return {
            fileName: this.currentPath?.split("/").pop() || "",
            filePath: this.currentPath || "",
            title: this.mdx?.header?.Title as string || "",
            description: this.mdx?.header?.Description as string || "",
            loaded: this.mdx !== null
        };
    }

    /**
     * 检查词典是否已加载
     */
    isLoaded(): boolean {
        return this.mdx !== null;
    }

    /**
     * 关闭词典
     */
    close(): void {
        if (this.mdx) {
            try {
                (this.mdx as any).close?.();
            } catch (e) {
                // ignore
            }
            this.mdx = null;
            this.currentPath = null;
        }
    }
}

/**
 * 创建 MDict 引擎实例
 */
export function createMdictEngine(basePath: string): MdictEngine {
    return new MdictEngine(basePath);
}