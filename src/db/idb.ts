import Dexie from "dexie";
import Plugin from "@/plugin";

/**
 * IndexedDB 数据库封装类
 *
 * 使用 Dexie 库封装 IndexedDB，提供两个表：
 * - expressions: 单词/词组表
 * - sentences: 例句表
 */
export default class WordDB extends Dexie {
    expressions: Dexie.Table<Expression, number>;  // 单词/词组表
    sentences: Dexie.Table<Sentence, number>;      // 例句表
    plugin: Plugin;
    dbName: string;
    constructor(plugin: Plugin) {
        super(plugin.settings.db_name);
        this.plugin = plugin;
        this.dbName = plugin.settings.db_name;
        // 定义数据库 schema
        // ++id: 自增主键
        // &expression: 唯一索引（不重复）
        // *tags: 多值索引（数组）

        // Version 1 - 初始schema
        this.version(1).stores({
            expressions: "++id, &expression, status, t, date, *tags",
            sentences: "++id, &text"
        });

        // Version 2 - 添加 createdDate 和 modifiedDate 索引
        this.version(2).stores({
            expressions: "++id, &expression, status, t, date, createdDate, modifiedDate, *tags",
            sentences: "++id, &text"
        }).upgrade(tx => {
            // 迁移现有数据：将 date 时间戳转换为日期字符串
            return tx.table("expressions").toCollection().modify(expr => {
                const dateStr = new Date(expr.date * 1000).toISOString().split('T')[0];
                expr.createdDate = dateStr;
                expr.modifiedDate = dateStr;
            });
        });
    }
}

interface Expression {
    id?: number,
    expression: string,
    meaning: string,
    status: number,
    t: string,
    date: number,
    notes: string[],
    tags: Set<string>,
    sentences: Set<number>,
    connections: Map<string, string>,
    createdDate: string,    // YYYY-MM-DD 格式，创建时设置，不可变
    modifiedDate: string,   // YYYY-MM-DD 格式，每次更新时刷新
}
interface Sentence {
    id?: number;
    text: string,
    trans: string,
    origin: string,
}