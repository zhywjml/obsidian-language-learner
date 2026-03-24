/**
 * Markdown 文件数据库实现
 *
 * 将单词数据存储在 Markdown 文件中，支持：
 * - Obsidian Sync 自动同步
 * - 用户可以直接查看和编辑
 * - Git 版本控制
 */

import { TFile, TFolder, normalizePath } from "obsidian";
import { moment } from "obsidian";
import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapData, HeatmapStats
} from "./interface";
import DbProvider from "./base";
import Plugin from "@/plugin";

/**
 * Markdown 文件格式（使用代码块包裹，避免被其他插件处理）：
 *
 * ```langr-words
 * ## Words
 *
 * ### hello
 * - meaning: 你好
 * - status: 3
 * - tags: greeting, common
 * - date: 2026-03-13
 * - notes:
 *   - A common greeting
 * - sentences:
 *   - Hello, how are you? | 你好吗？ | Example sentence
 *
 * ### goodbye
 * ...
 *
 * ## Phrases
 *
 * ### look forward to
 * ...
 * ```
 */

/**
 * Markdown 文件数据库
 */
export class MarkdownDb extends DbProvider {
    plugin: Plugin;
    filePath: string;
    words: Map<string, ExpressionInfo>;  // 内存缓存
    pendingSave: boolean = false;
    saveTimeout: NodeJS.Timeout = null;
    private loadPromise: Promise<void> | null = null;

    constructor(plugin: Plugin, filePath: string) {
        super();
        this.plugin = plugin;
        this.filePath = normalizePath(filePath);
        this.words = new Map();
    }

    async open(): Promise<void> {
        // 直接加载
        await this.loadFromFile();
        // 设置 loadPromise 为已完成的空 Promise
        this.loadPromise = Promise.resolve();
    }

    /**
     * 确保数据已加载（如果为空则重新加载）
     */
    private async ensureLoaded(): Promise<void> {
        if (this.words.size === 0) {
            await this.loadFromFile();
        }
    }

    /**
     * 重新加载文件（路径改变时调用）
     */
    async reload(newPath?: string): Promise<void> {
        if (newPath) {
            this.filePath = normalizePath(newPath);
        }
        await this.loadFromFile();
    }

    close(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.pendingSave) {
            this.saveToFileSync();
        }
    }

    /**
     * 从 Markdown 文件加载数据
     */
    private async loadFromFile(): Promise<void> {
        const vault = this.plugin.app.vault;
        const file = vault.getAbstractFileByPath(this.filePath);

        if (file instanceof TFile) {
            try {
                const content = await vault.read(file);
                this.parseMarkdown(content);
                console.log(`Language Learner: Loaded ${this.words.size} words from ${this.filePath}`);
            } catch (e) {
                console.error("Failed to load Markdown database:", e);
                this.words.clear();
            }
        } else {
            // 文件不存在，创建新文件
            await this.createEmptyFile();
        }
    }

    /**
     * 解析 Markdown 内容
     */
    private parseMarkdown(content: string): void {
        this.words.clear();

        // 尝试提取代码块中的内容（宽松匹配，允许结尾没有换行符）
        const codeBlockMatch = content.match(/```langr-words\n([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
            this.parseContent(codeBlockMatch[1]);
            return;
        }

        // 兼容旧格式（没有代码块包裹，但有 ## Words 或 ## Phrases）
        if (content.includes('## Words') || content.includes('## Phrases')) {
            this.parseContent(content);
        }
    }

    /**
     * 解析实际内容
     */
    private parseContent(content: string): void {
        const lines = content.split('\n');
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

            // 检测单词/短语标题 (### word)
            if (line.startsWith('### ') && section !== 'none') {
                // 保存上一个单词
                if (currentWord) {
                    this.words.set(currentWord.expression.toLowerCase(), currentWord);
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

            // 检测其他属性开始，结束 meaning 收集
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
            } else if (line.startsWith('- date:')) {
                // 日期信息，可选
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
                    // 格式: text | trans | origin
                    const parts = content.split('|').map(p => p.trim());
                    currentWord.sentences.push({
                        text: parts[0] || '',
                        trans: parts[1] || '',
                        origin: parts[2] || ''
                    });
                } else if (inMeaning) {
                    // 多行 meaning 的后续行（带缩进但没有 - ）
                    currentWord.meaning += '\n' + content;
                }
            } else if (inMeaning && line.trim() && !line.startsWith('- ') && currentWord) {
                // 继续累积 meaning 内容（多行，不带 - 前缀但带缩进）
                currentWord.meaning += '\n' + line.trim();
            }
        }

        // 保存最后一个单词
        if (currentWord) {
            this.words.set(currentWord.expression.toLowerCase(), currentWord);
        }
    }

    /**
     * 生成 Markdown 内容（仅代码块，无标题）
     */
    private generateMarkdown(): string {
        const words: ExpressionInfo[] = [];
        const phrases: ExpressionInfo[] = [];

        for (const word of this.words.values()) {
            if (word.t === 'PHRASE') {
                phrases.push(word);
            } else {
                words.push(word);
            }
        }

        // 构建代码块内的内容
        let innerContent = `## Words\n\n`;
        for (const word of words) {
            innerContent += this.formatEntry(word);
        }

        innerContent += `## Phrases\n\n`;
        for (const phrase of phrases) {
            innerContent += this.formatEntry(phrase);
        }

        // 仅输出代码块，防止被其他插件处理
        return `\`\`\`langr-words
${innerContent.trim()}
\`\`\`
`;
    }

    /**
     * 格式化单个词条
     */
    private formatEntry(entry: ExpressionInfo): string {
        let content = `### ${entry.expression}\n`;
        // 处理多行 meaning，确保后续行有缩进
        if (entry.meaning.includes('\n')) {
            const lines = entry.meaning.split('\n');
            content += `- meaning: ${lines[0]}\n`;
            for (let i = 1; i < lines.length; i++) {
                content += `  ${lines[i]}\n`;
            }
        } else {
            content += `- meaning: ${entry.meaning}\n`;
        }
        content += `- status: ${entry.status}\n`;
        if (entry.tags.length > 0) {
            content += `- tags: ${entry.tags.join(', ')}\n`;
        }
        content += `- date: ${moment().format('YYYY-MM-DD')}\n`;

        if (entry.notes.length > 0) {
            content += `- notes:\n`;
            for (const note of entry.notes) {
                content += `  - ${note}\n`;
            }
        }

        if (entry.sentences.length > 0) {
            content += `- sentences:\n`;
            for (const sen of entry.sentences) {
                content += `  - ${sen.text}`;
                if (sen.trans) content += ` | ${sen.trans}`;
                if (sen.origin) content += ` | ${sen.origin}`;
                content += '\n';
            }
        }

        content += '\n';
        return content;
    }

    /**
     * 创建空文件
     */
    private async createEmptyFile(): Promise<void> {
        const vault = this.plugin.app.vault;

        // 检查文件是否已存在
        const existingFile = vault.getAbstractFileByPath(this.filePath);
        if (existingFile instanceof TFile) {
            return; // 文件已存在，无需创建
        }

        const parentPath = this.filePath.substring(0, this.filePath.lastIndexOf('/'));

        if (parentPath) {
            await this.ensureFolder(parentPath);
        }

        // 创建空的代码块格式
        const content = `\`\`\`langr-words
## Words

## Phrases
\`\`\`
`;
        try {
            await vault.create(this.filePath, content);
        } catch (e) {
            // 文件可能已存在，忽略错误
            if (!e.message?.includes('already exists')) {
                console.warn("Failed to create file:", e);
            }
        }
    }

    /**
     * 确保文件夹存在
     */
    private async ensureFolder(path: string): Promise<void> {
        const vault = this.plugin.app.vault;
        const folder = vault.getAbstractFileByPath(path);
        if (folder instanceof TFolder) {
            return; // 文件夹已存在
        }
        try {
            await vault.createFolder(path);
        } catch (e) {
            // 文件夹可能已存在，忽略错误
            if (!e.message?.includes('already exists')) {
                console.warn("Failed to create folder:", e);
            }
        }
    }

    /**
     * 计划保存（防抖）
     */
    private scheduleSave(): void {
        this.pendingSave = true;
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveToFile();
        }, 500);
    }

    /**
     * 异步保存（自动创建文件）
     */
    private async saveToFile(): Promise<void> {
        const vault = this.plugin.app.vault;
        let file = vault.getAbstractFileByPath(this.filePath);

        try {
            const content = this.generateMarkdown();
            if (file instanceof TFile) {
                await vault.modify(file, content);
            } else {
                // 文件不存在，创建新文件
                await this.createEmptyFile();
                file = vault.getAbstractFileByPath(this.filePath);
                if (file instanceof TFile) {
                    await vault.modify(file, content);
                }
            }
            this.pendingSave = false;
        } catch (e) {
            console.error("Failed to save Markdown database:", e);
        }
    }

    /**
     * 同步保存
     */
    private saveToFileSync(): void {
        this.saveToFile();
    }

    // ========== DbProvider 接口实现 ==========

    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        // 确保数据已加载
        await this.ensureLoaded();

        const storedPhrases = new Map<string, number>();
        const storedWords: Word[] = [];

        for (const word of payload.words) {
            const expr = this.words.get(word.toLowerCase());
            if (expr) {
                if (expr.t === 'PHRASE') {
                    storedPhrases.set(expr.expression, expr.status);
                } else {
                    storedWords.push({ text: expr.expression, status: expr.status });
                }
            }
        }

        // 搜索词组
        const { createAutomaton } = await import("ac-auto");
        const ac = await createAutomaton([...storedPhrases.keys()]);
        const searchedPhrases = (await ac.search(payload.article)).map(match => {
            return {
                text: match[1] as string,
                status: storedPhrases.get(match[1] as string)!,
                offset: match[0] as number
            } as Phrase;
        });

        return { words: storedWords, phrases: searchedPhrases };
    }

    async getExpression(expression: string): Promise<ExpressionInfo | null> {
        await this.ensureLoaded();
        return this.words.get(expression.toLowerCase()) || null;
    }

    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        await this.ensureLoaded();
        const result: ExpressionInfoSimple[] = [];
        for (const expr of expressions) {
            const word = this.words.get(expr.toLowerCase());
            if (word) {
                result.push({
                    expression: word.expression,
                    meaning: word.meaning,
                    status: word.status,
                    t: word.t,
                    tags: word.tags,
                    note_num: word.notes.length,
                    sen_num: word.sentences.length,
                    date: 0
                });
            }
        }
        return result;
    }

    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        await this.ensureLoaded();
        // Markdown 格式不存储精确时间，返回所有非无视的
        const result: ExpressionInfo[] = [];
        for (const word of this.words.values()) {
            if (word.status > 0) {
                result.push(word);
            }
        }
        return result;
    }

    async getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        await this.ensureLoaded();
        const bottomStatus = ignores ? -1 : 0;
        const result: ExpressionInfoSimple[] = [];

        for (const word of this.words.values()) {
            if (word.status > bottomStatus) {
                result.push({
                    expression: word.expression,
                    meaning: word.meaning,
                    status: word.status,
                    t: word.t,
                    tags: word.tags,
                    note_num: word.notes.length,
                    sen_num: word.sentences.length,
                    date: 0
                });
            }
        }
        return result;
    }

    async postExpression(payload: ExpressionInfo): Promise<number> {
        const key = payload.expression.toLowerCase();

        const word: ExpressionInfo = {
            expression: payload.expression,
            meaning: payload.meaning,
            status: payload.status,
            t: payload.t,
            notes: payload.notes || [],
            tags: payload.tags || [],
            sentences: payload.sentences || []
        };

        this.words.set(key, word);
        this.scheduleSave();

        return 200;
    }

    async getTags(): Promise<string[]> {
        await this.ensureLoaded();
        const tags = new Set<string>();
        for (const word of this.words.values()) {
            for (const tag of word.tags) {
                tags.add(tag);
            }
        }
        return [...tags];
    }

    async postIgnoreWords(payload: string[]): Promise<void> {
        await this.ensureLoaded();
        for (const expr of payload) {
            const key = expr.toLowerCase();
            if (!this.words.has(key)) {
                this.words.set(key, {
                    expression: expr,
                    meaning: '',
                    status: 0,
                    t: 'WORD',
                    notes: [],
                    tags: [],
                    sentences: []
                });
            }
        }
        this.scheduleSave();
    }

    async tryGetSen(text: string): Promise<Sentence | null> {
        await this.ensureLoaded();
        for (const word of this.words.values()) {
            for (const sen of word.sentences) {
                if (sen.text === text) {
                    return sen;
                }
            }
        }
        return null;
    }

    async getCount(): Promise<CountInfo> {
        await this.ensureLoaded();
        const counts = {
            WORD: new Array(5).fill(0),
            PHRASE: new Array(5).fill(0)
        };

        for (const word of this.words.values()) {
            if (word.t === 'WORD' || word.t === 'PHRASE') {
                counts[word.t][word.status]++;
            }
        }

        return {
            word_count: counts.WORD,
            phrase_count: counts.PHRASE
        };
    }

    async countSeven(): Promise<WordCount[]> {
        // Markdown 格式不存储精确时间，返回空统计
        return Array(7).fill(null).map(() => ({
            today: new Array(5).fill(0),
            accumulated: new Array(5).fill(0)
        }));
    }

    async getHeatmapData(): Promise<HeatmapStats> {
        await this.ensureLoaded();

        // Markdown 格式不存储精确时间，返回基于当前日期的模拟数据
        // 实际使用时建议切换到 IndexedDB 存储方式
        const today = moment();
        const startDate = today.clone().subtract(30, 'days');
        const data: HeatmapData[] = [];

        let current = startDate.clone();
        while (current.isSameOrBefore(today)) {
            data.push({
                date: current.format('YYYY-MM-DD'),
                count: 0,
                level: 0,
            });
            current.add(1, 'day');
        }

        return {
            totalDays: data.length,
            totalLearned: this.words.size,
            longestStreak: 0,
            currentStreak: 0,
            data: data,
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: today.format('YYYY-MM-DD'),
        };
    }

    async destroyAll(): Promise<void> {
        this.words.clear();
        await this.saveToFile();
    }

    async importDB(file: File): Promise<void> {
        const content = await file.text();

        // 尝试检测文件类型
        if (content.trim().startsWith('{')) {
            // JSON 格式
            const data = JSON.parse(content);
            if (data.words && Array.isArray(data.words)) {
                for (const word of data.words) {
                    this.words.set(word.expression.toLowerCase(), {
                        expression: word.expression,
                        meaning: word.meaning || '',
                        status: word.status || 1,
                        t: word.t || 'WORD',
                        notes: word.notes || [],
                        tags: word.tags || [],
                        sentences: word.sentences || []
                    });
                }
            }
        } else {
            // Markdown 格式
            this.parseMarkdown(content);
        }

        await this.saveToFile();
    }

    async exportDB(): Promise<void> {
        await this.ensureLoaded();
        const content = this.generateMarkdown();
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `language-learner-${moment().format('YYYY-MM-DD')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
}