/**
 * MDict 词典解析引擎
 *
 * 使用 js-mdict 库解析 .mdx 文件
 */

import { MDX, Mdict, KeyWordItem } from "js-mdict";
import { Notice, TFile, Platform, Vault } from "obsidian";
import { MdictSearchResult, MdictSuggestion, MdictInfo, MdictConfig } from "./types";

/**
 * MDict 引擎类
 * 管理单个或多个 MDict 词典
 */
export class MdictEngine {
    private mdx: MDX | null = null;
    private basePath: string;
    private currentPath: string | null = null;
    private vault: Vault | null = null;

    constructor(basePath: string, vault?: Vault) {
        this.basePath = basePath;
        this.vault = vault || null;
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

            // 尝试加载词典
            this.mdx = await this.createMdxFromPath(relativePath, fullPath);

            if (!this.mdx) {
                return false;
            }

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
     * 根据路径创建 MDX 实例
     * 优先尝试通过 vault 读取（支持移动端），失败则回退到文件系统
     */
    private async createMdxFromPath(relativePath: string, fullPath: string): Promise<MDX | null> {
        // 方案1：尝试通过 Obsidian Vault 读取文件（支持移动端）
        if (this.vault) {
            try {
                // 标准化路径获取文件
                const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\//, "");
                const file = this.vault.getAbstractFileByPath(normalizedPath);

                if (file && file instanceof TFile) {
                    // 读取文件为二进制
                    const arrayBuffer = await this.vault.readBinary(file);
                    console.log("Loading MDict via Vault binary, size:", arrayBuffer.byteLength);

                    // 使用 ArrayBuffer 创建 MDX（js-mdict 支持 ArrayBuffer）
                    return new MDX(arrayBuffer as any, {
                        resort: true,
                        isStripKey: true,
                        isCaseSensitive: false,
                    });
                }
            } catch (vaultError) {
                console.log("Vault read failed, trying file system:", vaultError);
            }
        }

        // 方案2：桌面端使用文件系统直接读取
        if (Platform.isDesktopApp) {
            try {
                return new MDX(fullPath, {
                    resort: true,
                    isStripKey: true,
                    isCaseSensitive: false,
                });
            } catch (fsError) {
                console.error("File system load failed:", fsError);
                throw new Error("无法加载词典文件");
            }
        }

        // 移动端且 vault 读取失败
        new Notice("无法在移动端读取词典文件");
        return null;
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
export function createMdictEngine(basePath: string, vault?: Vault): MdictEngine {
    return new MdictEngine(basePath, vault);
}