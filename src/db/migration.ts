/**
 * 数据迁移工具
 *
 * 支持从现有数据源迁移到 JSON 同步格式：
 * - Markdown 文件 (words.md) → JSON 文件
 * - IndexedDB → JSON 文件
 */

import { TFile, Vault, normalizePath, moment } from "obsidian";
import { JsonDataFormat, JsonExpression, JsonSentence, createDefaultMetadata } from "./json_format";
import { createJsonDataFormat, computeHash } from "./json_serializer";
import { LocalDb } from "./local_db";
import type { ExpressionInfo } from "./interface";

/**
 * 迁移结果
 */
export interface MigrationResult {
    success: boolean;
    expressionsMigrated: number;
    sentencesMigrated: number;
    errors: string[];
}

/**
 * 数据迁移工具
 */
export class DataMigration {
    /**
     * 从 Markdown 文件迁移到 JSON
     */
    static async migrateMarkdownToJson(
        mdPath: string,
        jsonPath: string,
        vault: Vault
    ): Promise<MigrationResult> {
        const result: MigrationResult = {
            success: false,
            expressionsMigrated: 0,
            sentencesMigrated: 0,
            errors: []
        };

        try {
            // 读取 Markdown 文件
            const file = vault.getAbstractFileByPath(normalizePath(mdPath));
            if (!(file instanceof TFile)) {
                result.errors.push(`Markdown file not found: ${mdPath}`);
                return result;
            }

            const content = await vault.read(file);
            const expressions = this.parseMarkdownContent(content);

            // 转换为 JSON 格式
            const jsonData = this.convertToJsonFormat(expressions);

            // 写入 JSON 文件
            await this.writeJsonFile(jsonPath, jsonData, vault);

            result.success = true;
            result.expressionsMigrated = jsonData.data.expressions.length;
            result.sentencesMigrated = jsonData.data.sentences.length;

            console.log(`[Migration] Migrated ${result.expressionsMigrated} expressions from Markdown to JSON`);
        } catch (e) {
            result.errors.push(String(e));
            console.error('[Migration] Migration failed:', e);
        }

        return result;
    }

    /**
     * 从 IndexedDB 导出到 JSON
     */
    static async exportIndexedDbToJson(
        localDb: LocalDb,
        jsonPath: string,
        vault: Vault
    ): Promise<MigrationResult> {
        const result: MigrationResult = {
            success: false,
            expressionsMigrated: 0,
            sentencesMigrated: 0,
            errors: []
        };

        try {
            // 获取所有数据
            const allExpressions = await localDb.getAllExpressionSimple(true);

            // 获取完整数据
            const fullExpressions: ExpressionInfo[] = [];
            for (const expr of allExpressions) {
                const full = await localDb.getExpression(expr.expression);
                if (full) {
                    fullExpressions.push(full);
                }
            }

            // 转换为 JSON 格式
            const jsonData = this.convertToJsonFormat(fullExpressions);

            // 写入 JSON 文件
            await this.writeJsonFile(jsonPath, jsonData, vault);

            result.success = true;
            result.expressionsMigrated = jsonData.data.expressions.length;
            result.sentencesMigrated = jsonData.data.sentences.length;

            console.log(`[Migration] Exported ${result.expressionsMigrated} expressions from IndexedDB to JSON`);
        } catch (e) {
            result.errors.push(String(e));
            console.error('[Migration] Export failed:', e);
        }

        return result;
    }

    /**
     * 解析 Markdown 内容
     * 复用 MarkdownDb 的解析逻辑
     */
    private static parseMarkdownContent(content: string): ExpressionInfo[] {
        const expressions: ExpressionInfo[] = [];

        // 尝试提取代码块中的内容
        const codeBlockMatch = content.match(/```langr-words\n([\s\S]*?)\n?```/);
        const parseContent = codeBlockMatch ? codeBlockMatch[1] : content;

        const lines = parseContent.split('\n');
        let currentWord: ExpressionInfo | null = null;
        let section: 'none' | 'words' | 'phrases' = 'none';
        let inNotes = false;
        let inSentences = false;
        let inMeaning = false;

        for (const line of lines) {
            // 检测章节
            if (line.startsWith('## Words')) {
                section = 'words';
                continue;
            } else if (line.startsWith('## Phrases')) {
                section = 'phrases';
                continue;
            }

            // 检测单词/短语标题
            if (line.startsWith('### ') && section !== 'none') {
                if (currentWord) {
                    expressions.push(currentWord);
                }

                currentWord = {
                    expression: line.substring(4).trim(),
                    meaning: '',
                    status: 1,
                    t: section === 'words' ? 'WORD' : 'PHRASE',
                    notes: [],
                    sentences: [],
                    tags: []
                };
                inNotes = false;
                inSentences = false;
                inMeaning = false;
                continue;
            }

            if (!currentWord) continue;

            // 检测其他属性开始
            if (line.startsWith('- status:') || line.startsWith('- tags:') ||
                line.startsWith('- date:') || line.startsWith('- notes:') ||
                line.startsWith('- sentences:')) {
                inMeaning = false;
            }

            // 解析属性
            if (line.startsWith('- meaning:')) {
                currentWord.meaning = line.substring(10).trim();
                inMeaning = true;
                inNotes = false;
                inSentences = false;
            } else if (line.startsWith('- status:')) {
                const statusVal = parseInt(line.substring(9).trim());
                currentWord.status = isNaN(statusVal) ? 1 : statusVal;
                inMeaning = false;
            } else if (line.startsWith('- tags:')) {
                const tagsStr = line.substring(7).trim();
                currentWord.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
            } else if (line.startsWith('- notes:')) {
                inNotes = true;
                inSentences = false;
                inMeaning = false;
            } else if (line.startsWith('- sentences:')) {
                inNotes = false;
                inSentences = true;
                inMeaning = false;
            } else if (line.startsWith('  - ') && currentWord) {
                const content = line.substring(4).trim();
                if (inNotes) {
                    currentWord.notes.push(content);
                } else if (inSentences) {
                    const parts = content.split('|').map(p => p.trim());
                    currentWord.sentences.push({
                        text: parts[0] || '',
                        trans: parts[1] || '',
                        origin: parts[2] || ''
                    });
                } else if (inMeaning) {
                    currentWord.meaning += '\n' + content;
                }
            } else if (inMeaning && line.trim() && !line.startsWith('- ') && currentWord) {
                currentWord.meaning += '\n' + line.trim();
            }
        }

        // 保存最后一个单词
        if (currentWord) {
            expressions.push(currentWord);
        }

        return expressions;
    }

    /**
     * 转换表达式列表为 JSON 格式
     */
    private static convertToJsonFormat(expressions: ExpressionInfo[]): JsonDataFormat {
        const jsonExpressions: JsonExpression[] = [];
        const jsonSentences: JsonSentence[] = [];
        const sentenceIdMap = new Map<string, number>();

        // 先收集所有句子并分配 ID
        for (const expr of expressions) {
            for (const sen of expr.sentences) {
                if (!sentenceIdMap.has(sen.text)) {
                    const id = jsonSentences.length + 1;
                    sentenceIdMap.set(sen.text, id);
                    jsonSentences.push({
                        id,
                        text: sen.text,
                        trans: sen.trans || '',
                        origin: sen.origin || ''
                    });
                }
            }
        }

        // 转换表达式
        for (const expr of expressions) {
            const sentenceIds = expr.sentences.map(s => sentenceIdMap.get(s.text) || 0);

            jsonExpressions.push({
                id: jsonExpressions.length + 1,
                expression: expr.expression.toLowerCase(),
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t as 'WORD' | 'PHRASE',
                date: Math.floor(Date.now() / 1000),
                notes: expr.notes || [],
                tags: expr.tags || [],
                sentenceIds
            });
        }

        return createJsonDataFormat(jsonExpressions, jsonSentences);
    }

    /**
     * 写入 JSON 文件
     */
    private static async writeJsonFile(
        jsonPath: string,
        data: JsonDataFormat,
        vault: Vault
    ): Promise<void> {
        const content = JSON.stringify(data, null, 2);
        const normalizedPath = normalizePath(jsonPath);

        // 确保目录存在
        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        if (parentPath) {
            const folder = vault.getAbstractFileByPath(parentPath);
            if (!folder) {
                await vault.createFolder(parentPath);
            }
        }

        const file = vault.getAbstractFileByPath(normalizedPath);
        if (file instanceof TFile) {
            await vault.modify(file, content);
        } else {
            await vault.create(normalizedPath, content);
        }
    }

    /**
     * 检查是否需要迁移
     */
    static async checkMigrationNeeded(
        mdPath: string,
        jsonPath: string,
        vault: Vault
    ): Promise<boolean> {
        const mdFile = vault.getAbstractFileByPath(normalizePath(mdPath));
        const jsonFile = vault.getAbstractFileByPath(normalizePath(jsonPath));

        // Markdown 存在但 JSON 不存在，需要迁移
        return mdFile instanceof TFile && !(jsonFile instanceof TFile);
    }
}