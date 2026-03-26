/**
 * JSON 文件格式类型定义
 *
 * 用于 words.json 文件的结构化存储，支持：
 * - Obsidian Sync 跨设备同步
 * - 与 IndexedDB 双向同步
 * - 版本化格式便于未来扩展
 */

/**
 * JSON 文件完整格式
 */
export interface JsonDataFormat {
    /** 格式版本号 */
    version: string;
    /** 固定为 "language-learner-words" */
    format: string;
    /** 元数据 */
    metadata: JsonMetadata;
    /** 数据内容 */
    data: JsonData;
}

/**
 * 元数据
 */
export interface JsonMetadata {
    /** 创建时间 (ISO 8601) */
    createdAt: string;
    /** 最后更新时间 (ISO 8601) */
    updatedAt: string;
    /** 设备唯一标识 */
    deviceId: string;
    /** 上次同步数据哈希，用于检测变更 */
    lastSyncHash: string;
    /** 表达式数量 */
    expressionCount: number;
    /** 例句数量 */
    sentenceCount: number;
}

/**
 * 数据内容
 */
export interface JsonData {
    /** 单词/短语列表 */
    expressions: JsonExpression[];
    /** 例句列表 */
    sentences: JsonSentence[];
}

/**
 * JSON 表达式格式
 *
 * 注意：与 IndexedDB 的 Expression 接口的区别：
 * - tags: Set<string> → string[]
 * - sentences: Set<number> → number[] (重命名为 sentenceIds)
 * - connections: Map → 不导出（目前未使用）
 */
export interface JsonExpression {
    /** 自增 ID（JSON 文件中可选，主要用于关联句子） */
    id: number;
    /** 单词/短语文本（小写） */
    expression: string;
    /** 释义 */
    meaning: string;
    /** 学习状态: 0=Ignore, 1=Learning, 2=Familiar, 3=Known, 4=Learned */
    status: number;
    /** 类型: WORD | PHRASE */
    t: 'WORD' | 'PHRASE';
    /** 创建/更新时间 (Unix timestamp) */
    date: number;
    /** 笔记 */
    notes: string[];
    /** 标签 */
    tags: string[];
    /** 关联的例句 ID 列表 */
    sentenceIds: number[];
}

/**
 * JSON 例句格式
 */
export interface JsonSentence {
    /** 自增 ID */
    id: number;
    /** 句子原文 */
    text: string;
    /** 翻译 */
    trans: string;
    /** 来源 */
    origin: string;
}

/**
 * 当前格式版本
 */
export const JSON_FORMAT_VERSION = "1.0.0";

/**
 * 格式标识符
 */
export const JSON_FORMAT_IDENTIFIER = "language-learner-words";

/**
 * 同步结果
 */
export interface SyncResult {
    /** 是否成功 */
    success: boolean;
    /** 同步方向 */
    direction: 'json-to-idb' | 'idb-to-json' | 'merge' | 'none';
    /** 统计信息 */
    stats: {
        expressionsProcessed: number;
        sentencesProcessed: number;
        expressionsAdded: number;
        expressionsUpdated: number;
        conflictsFound: number;
        conflictsResolved: number;
    };
    /** 错误信息 */
    errors: string[];
}

/**
 * 同步冲突
 */
export interface SyncConflict {
    /** 冲突类型 */
    type: 'expression' | 'sentence';
    /** 标识符 */
    id: string | number;
    /** JSON 中的值 */
    jsonValue: JsonExpression | JsonSentence;
    /** IndexedDB 中的值 */
    idbValue: JsonExpression | JsonSentence;
    /** JSON 时间戳 */
    jsonTimestamp: number;
    /** IndexedDB 时间戳 */
    idbTimestamp: number;
}

/**
 * 默认元数据
 */
export function createDefaultMetadata(): JsonMetadata {
    return {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deviceId: generateDeviceId(),
        lastSyncHash: '',
        expressionCount: 0,
        sentenceCount: 0
    };
}

/**
 * 生成设备 ID
 */
function generateDeviceId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 创建空的 JSON 数据结构
 */
export function createEmptyJsonData(): JsonDataFormat {
    return {
        version: JSON_FORMAT_VERSION,
        format: JSON_FORMAT_IDENTIFIER,
        metadata: createDefaultMetadata(),
        data: {
            expressions: [],
            sentences: []
        }
    };
}