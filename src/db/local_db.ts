import { moment } from "obsidian";
import { createAutomaton, Automaton } from "ac-auto";
import { exportDB, importInto } from "dexie-export-import";
import download from "downloadjs";

import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapData, HeatmapStats
} from "./interface";
import DbProvider from "./base";
import WordDB from "./idb";
import Plugin from "@/plugin";

/**
 * 本地数据库实现类
 *
 * 使用 IndexedDB 存储单词、词组、例句等数据
 * 继承自 DbProvider 抽象类，实现所有数据库操作
 */
export class LocalDb extends DbProvider {
    idb: WordDB;      // Dexie 数据库实例
    plugin: Plugin;

    // AC 自动机缓存
    private acCache: {
        automaton: Automaton | null;
        phrasesHash: string;  // 短语数据哈希，用于判断是否需要重建
    } = {
        automaton: null,
        phrasesHash: ""
    };

    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.idb = new WordDB(plugin);
    }

    async open() {
        await this.idb.open();
        return;
    }

    close() {
        this.idb.close();
    }

    /**
     * 计算短语列表的简单哈希
     */
    private hashPhrases(phrases: string[]): string {
        // 使用简单的字符串哈希，考虑性能和冲突平衡
        let hash = 0;
        const str = phrases.sort().join("|");
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    /**
     * 清除 AC 自动机缓存
     * 在短语数据发生变化时调用
     */
    clearACCache(): void {
        this.acCache.automaton = null;
        this.acCache.phrasesHash = "";
    }

    /**
     * 在文章中查找已记录的单词和词组
     * @param payload 包含文章文本和待查询单词列表
     * @returns 匹配的单词和词组
     */
    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        // 获取所有短语及其状态
        let storedPhrases = new Map<string, number>();
        await this.idb.expressions
            .where("t").equals("PHRASE")
            .each(expr => storedPhrases.set(expr.expression, expr.status));

        let storedWords = (await this.idb.expressions
            .where("expression").anyOf(payload.words)
            .toArray()
        ).map(expr => {
            return { text: expr.expression, status: expr.status } as Word;
        });

        // 计算当前短语哈希
        const phraseKeys = [...storedPhrases.keys()];
        const currentHash = this.hashPhrases(phraseKeys);

        // 检查缓存是否有效
        let ac: Automaton;
        if (this.acCache.automaton && this.acCache.phrasesHash === currentHash) {
            // 使用缓存的自动机
            ac = this.acCache.automaton;
        } else {
            // 重建自动机并缓存
            ac = await createAutomaton(phraseKeys);
            this.acCache.automaton = ac;
            this.acCache.phrasesHash = currentHash;
        }

        let searchedPhrases = (await ac.search(payload.article)).map(match => {
            return { text: match[1], status: storedPhrases.get(match[1]), offset: match[0] } as Phrase;
        });

        return { words: storedWords, phrases: searchedPhrases };
    }

    async getExpression(expression: string): Promise<ExpressionInfo> {
        expression = expression.toLowerCase();
        let expr = await this.idb.expressions
            .where("expression").equals(expression).first();

        if (!expr) {
            return null;
        }

        let sentences = await this.idb.sentences
            .where("id").anyOf([...expr.sentences.values()])
            .toArray();

        return {
            expression: expr.expression,
            meaning: expr.meaning,
            status: expr.status,
            t: expr.t,
            notes: expr.notes,
            sentences,
            tags: [...expr.tags.keys()],
        };

    }

    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        expressions = expressions.map(e => e.toLowerCase());

        let exprs = await this.idb.expressions
            .where("expression")
            .anyOf(expressions)
            .toArray();

        return exprs.map(v => {
            return {
                expression: v.expression,
                meaning: v.meaning,
                status: v.status,
                t: v.t,
                tags: [...v.tags.keys()],
                sen_num: v.sentences.size,
                note_num: v.notes.length,
                date: v.date
            };
        });
    }

    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        let unixStamp = moment.utc(time).unix();
        let wordsAfter = await this.idb.expressions
            .where("status").above(0)
            .and(expr => expr.date > unixStamp)
            .toArray();

        let res: ExpressionInfo[] = [];
        for (let expr of wordsAfter) {
            let sentences = await this.idb.sentences
                .where("id").anyOf([...expr.sentences.values()])
                .toArray();

            res.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: expr.notes,
                sentences,
                tags: [...expr.tags.keys()],
            });
        }
        return res;
    }
    async getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        let exprs: ExpressionInfoSimple[];
        let bottomStatus = ignores ? -1 : 0;
        exprs = (await this.idb.expressions
            .where("status").above(bottomStatus)
            .toArray()
        ).map((expr): ExpressionInfoSimple => {
            return {
                expression: expr.expression,
                status: expr.status,
                meaning: expr.meaning,
                t: expr.t,
                tags: [...expr.tags.keys()],
                note_num: expr.notes.length,
                sen_num: expr.sentences.size,
                date: expr.date,
            };
        });

        return exprs;
    }

    async postExpression(payload: ExpressionInfo): Promise<number> {
        let stored = await this.idb.expressions
            .where("expression").equals(payload.expression)
            .first();

        let sentences = new Set<number>();
        for (let sen of payload.sentences) {
            let searched = await this.idb.sentences.where("text").equals(sen.text).first();
            if (searched) {
                await this.idb.sentences.update(searched.id, sen);
                sentences.add(searched.id);
            } else {
                let id = await this.idb.sentences.add(sen);
                sentences.add(id);
            }
        }

        let updatedWord = {
            expression: payload.expression,
            meaning: payload.meaning,
            status: payload.status,
            t: payload.t,
            notes: payload.notes,
            sentences,
            tags: new Set<string>(payload.tags),
            connections: new Map<string, string>(),
            date: moment().unix()
        };
        if (stored) {
            await this.idb.expressions.update(stored.id, updatedWord);
        } else {
            await this.idb.expressions.add(updatedWord);
        }

        // 如果添加/更新的是短语，清除 AC 缓存
        if (payload.t === "PHRASE") {
            this.clearACCache();
        }

        return 200;
    }

    async getTags(): Promise<string[]> {
        let allTags = new Set<string>();
        await this.idb.expressions.each(expr => {
            for (let t of expr.tags.values()) {
                allTags.add(t);
            }
        });

        return [...allTags.values()];
    }

    async postIgnoreWords(payload: string[]): Promise<void> {

        await this.idb.expressions.bulkPut(
            payload.map(expr => {
                return {
                    expression: expr,
                    meaning: "",
                    status: 0,
                    t: "WORD",
                    notes: [],
                    sentences: new Set(),
                    tags: new Set(),
                    connections: new Map<string, string>(),
                    date: moment().unix()
                };
            })
        );
        return;
    }

    async tryGetSen(text: string): Promise<Sentence> {
        let stored = await this.idb.sentences.where("text").equals(text).first();
        return stored;
    }

    async getCount(): Promise<CountInfo> {
        let counts: { "WORD": number[], "PHRASE": number[]; } = {
            "WORD": new Array(5).fill(0),
            "PHRASE": new Array(5).fill(0),
        };
        await this.idb.expressions.each(expr => {
            counts[expr.t as "WORD" | "PHRASE"][expr.status]++;
        });

        return {
            word_count: counts.WORD,
            phrase_count: counts.PHRASE
        };
    }

    async countSeven(): Promise<WordCount[]> {
        let spans: Span[] = [];
        spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            let start = moment().subtract(6, "days").startOf("day");
            let from = start.add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        let res: WordCount[] = [];

        // 对每一天计算
        for (let span of spans) {
            // 当日
            let today = new Array(5).fill(0);
            await this.idb.expressions.filter(expr => {
                return expr.t == "WORD" &&
                    expr.date >= span.from &&
                    expr.date <= span.to;
            }).each(expr => {
                today[expr.status]++;
            });
            // 累计
            let accumulated = new Array(5).fill(0);
            await this.idb.expressions.filter(expr => {
                return expr.t == "WORD" &&
                    expr.date <= span.to;
            }).each(expr => {
                accumulated[expr.status]++;
            });

            res.push({ today, accumulated });
        }

        return res;
    }

    /**
     * 获取热力图数据（GitHub 风格）
     * 返回从开始学习到今天所有的学习记录
     */
    async getHeatmapData(): Promise<HeatmapStats> {
        // 获取所有非忽略的单词（status > 0）
        let allExpressions: { date: number; status: number }[] = [];
        await this.idb.expressions
            .filter(expr => expr.t === "WORD" && expr.status > 0)
            .each(expr => {
                allExpressions.push({ date: expr.date, status: expr.status });
            });

        if (allExpressions.length === 0) {
            return {
                totalDays: 0,
                totalLearned: 0,
                longestStreak: 0,
                currentStreak: 0,
                data: [],
                startDate: moment().format("YYYY-MM-DD"),
                endDate: moment().format("YYYY-MM-DD"),
            };
        }

        // 按日期分组统计
        let dateMap = new Map<string, number>();
        for (let expr of allExpressions) {
            let dateStr = moment.unix(expr.date).format("YYYY-MM-DD");
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        }

        // 获取日期范围
        let dates = Array.from(dateMap.keys()).sort();
        let startDate = dates[0];
        let endDate = dates[dates.length - 1];

        // 填充整个日期范围（包括没有学习的天数）
        let start = moment(startDate);
        let end = moment(endDate);
        let current = start.clone();

        let heatmapData: HeatmapData[] = [];
        let maxCount = 0;

        while (current.isSameOrBefore(end)) {
            let dateStr = current.format("YYYY-MM-DD");
            let count = dateMap.get(dateStr) || 0;
            heatmapData.push({
                date: dateStr,
                count: count,
                level: 0, // 稍后计算
            });
            if (count > maxCount) {
                maxCount = count;
            }
            current.add(1, "day");
        }

        // 计算强度等级（0-4）
        for (let data of heatmapData) {
            if (data.count === 0) {
                data.level = 0;
            } else if (maxCount <= 4) {
                data.level = data.count;
            } else {
                // 按比例分配等级
                let ratio = data.count / maxCount;
                if (ratio <= 0.25) data.level = 1;
                else if (ratio <= 0.5) data.level = 2;
                else if (ratio <= 0.75) data.level = 3;
                else data.level = 4;
            }
        }

        // 计算连续学习天数
        let longestStreak = 0;
        let currentStreak = 0;
        let tempStreak = 0;

        for (let data of heatmapData) {
            if (data.count > 0) {
                tempStreak++;
                if (tempStreak > longestStreak) {
                    longestStreak = tempStreak;
                }
            } else {
                tempStreak = 0;
            }
        }

        // 计算当前连续学习天数（从今天往前数）
        let today = moment().format("YYYY-MM-DD");
        let todayIndex = heatmapData.findIndex(d => d.date === today);
        if (todayIndex === -1) {
            todayIndex = heatmapData.length - 1;
        }

        for (let i = todayIndex; i >= 0; i--) {
            if (heatmapData[i].count > 0) {
                currentStreak++;
            } else {
                break;
            }
        }

        return {
            totalDays: heatmapData.length,
            totalLearned: allExpressions.length,
            longestStreak,
            currentStreak,
            data: heatmapData,
            startDate,
            endDate,
        };
    }

    async importDB(file: File) {
        await this.idb.delete();
        await this.idb.open();
        await importInto(this.idb, file, {
            acceptNameDiff: true
        });
    }

    async exportDB() {
        let blob = await exportDB(this.idb);
        try {
            download(blob, `${this.idb.dbName}.json`, "application/json");
        } catch (e) {
            console.error("error exporting database");
        }
    }

    async destroyAll() {
        return this.idb.delete();
    }
}


