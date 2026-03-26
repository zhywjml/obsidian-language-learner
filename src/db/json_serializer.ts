/**
 * JSON 序列化/反序列化工具
 *
 * 处理 IndexedDB 数据结构与 JSON 格式之间的转换：
 * - Set ↔ Array
 * - 时间戳格式化
 * - 数据哈希计算
 */

import {
    JsonDataFormat,
    JsonData,
    JsonExpression,
    JsonSentence,
    JSON_FORMAT_VERSION,
    JSON_FORMAT_IDENTIFIER,
    createDefaultMetadata
} from './json_format';
import type { ExpressionInfo, Sentence } from './interface';

/**
 * IndexedDB 内部 Expression 类型（参考 idb.ts）
 */
interface InternalExpression {
    id?: number;
    expression: string;
    meaning: string;
    status: number;
    t: string;
    date: number;
    notes: string[];
    tags: Set<string>;
    sentences: Set<number>;
    connections: Map<string, string>;
    createdDate: string;
    modifiedDate: string;
}

/**
 * 序列化 Expression 为 JSON 格式
 */
export function serializeExpression(
    expr: InternalExpression,
    id: number
): JsonExpression {
    return {
        id,
        expression: expr.expression,
        meaning: expr.meaning,
        status: expr.status,
        t: expr.t as 'WORD' | 'PHRASE',
        date: expr.date,
        notes: expr.notes || [],
        tags: expr.tags ? [...expr.tags] : [],
        sentenceIds: expr.sentences ? [...expr.sentences] : []
    };
}

/**
 * 反序列化 JSON Expression 为 IndexedDB 格式
 * @param json JSON 表达式数据
 * @returns IndexedDB 内部表达式格式
 */
export function deserializeExpression(json: JsonExpression): InternalExpression {
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return {
        id: json.id,
        expression: json.expression,
        meaning: json.meaning,
        status: json.status,
        t: json.t,
        date: json.date,
        notes: json.notes || [],
        tags: new Set(json.tags || []),
        sentences: new Set(json.sentenceIds || []),
        connections: new Map(),
        createdDate: (json as any).createdDate || now,
        modifiedDate: (json as any).modifiedDate || now,
    };
}

/**
 * 序列化 Sentence 为 JSON 格式
 */
export function serializeSentence(
    sentence: Sentence,
    id: number
): JsonSentence {
    return {
        id,
        text: sentence.text,
        trans: sentence.trans || '',
        origin: sentence.origin || ''
    };
}

/**
 * 反序列化 JSON Sentence
 */
export function deserializeSentence(json: JsonSentence): Sentence {
    return {
        text: json.text,
        trans: json.trans || '',
        origin: json.origin || ''
    };
}

/**
 * 将 ExpressionInfo（API 格式）转换为 JSON 格式
 */
export function expressionInfoToJson(
    expr: ExpressionInfo,
    id: number,
    sentenceIdMap: Map<string, number>
): JsonExpression {
    // 为句子分配 ID
    const sentenceIds = expr.sentences.map(s => {
        const key = s.text;
        if (sentenceIdMap.has(key)) {
            return sentenceIdMap.get(key)!;
        }
        const newId = sentenceIdMap.size + 1;
        sentenceIdMap.set(key, newId);
        return newId;
    });

    return {
        id,
        expression: expr.expression.toLowerCase(),
        meaning: expr.meaning,
        status: expr.status,
        t: expr.t as 'WORD' | 'PHRASE',
        date: Math.floor(Date.now() / 1000),
        notes: expr.notes || [],
        tags: expr.tags || [],
        sentenceIds
    };
}

/**
 * 递归排序对象键，确保序列化结果稳定
 */
function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
}

/**
 * 计算数据的哈希值
 * 用于检测数据是否发生变化
 */
export function computeHash(data: JsonData): string {
    // 使用递归键排序确保稳定的序列化结果
    const sorted = sortObjectKeys(data) as JsonData;
    const str = JSON.stringify(sorted);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

/**
 * 创建完整的 JSON 数据结构
 */
export function createJsonDataFormat(
    expressions: JsonExpression[],
    sentences: JsonSentence[],
    existingMetadata?: Partial<JsonDataFormat['metadata']>
): JsonDataFormat {
    const now = new Date().toISOString();
    const data: JsonData = { expressions, sentences };

    return {
        version: JSON_FORMAT_VERSION,
        format: JSON_FORMAT_IDENTIFIER,
        metadata: {
            ...createDefaultMetadata(),
            ...existingMetadata,
            updatedAt: now,
            expressionCount: expressions.length,
            sentenceCount: sentences.length,
            lastSyncHash: computeHash(data)
        },
        data
    };
}

/**
 * 验证 JSON 格式是否有效
 */
export function validateJsonFormat(data: unknown): data is JsonDataFormat {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    // 检查必要字段
    if (obj.format !== JSON_FORMAT_IDENTIFIER) return false;
    if (!obj.data || typeof obj.data !== 'object') return false;

    const dataObj = obj.data as Record<string, unknown>;
    if (!Array.isArray(dataObj.expressions)) return false;
    if (!Array.isArray(dataObj.sentences)) return false;

    return true;
}

/**
 * 合并两个表达式数据（以时间戳为准）
 */
export function mergeExpressions(
    local: JsonExpression[],
    remote: JsonExpression[]
): JsonExpression[] {
    const map = new Map<string, JsonExpression>();

    // 先添加本地数据
    for (const expr of local) {
        map.set(expr.expression.toLowerCase(), expr);
    }

    // 合并远程数据
    for (const expr of remote) {
        const key = expr.expression.toLowerCase();
        const existing = map.get(key);

        if (!existing) {
            // 本地不存在，添加
            map.set(key, expr);
        } else if (expr.date > existing.date) {
            // 远程更新，替换
            map.set(key, expr);
        }
        // 否则保留本地
    }

    return [...map.values()];
}

/**
 * 合并两个句子数据
 * 使用"优先保留有内容"策略：
 * - 如果 remote 有 trans 而本地没有，使用 remote 的 trans
 * - 如果 remote 有 origin 而本地没有，使用 remote 的 origin
 */
export function mergeSentences(
    local: JsonSentence[],
    remote: JsonSentence[]
): JsonSentence[] {
    const map = new Map<string, JsonSentence>();

    // 先添加本地数据
    for (const sen of local) {
        map.set(sen.text, sen);
    }

    // 合并远程数据
    for (const sen of remote) {
        const existing = map.get(sen.text);

        if (!existing) {
            // 本地不存在，直接添加
            map.set(sen.text, sen);
        } else {
            // 本地已存在，合并内容（优先保留有内容的值）
            const merged: JsonSentence = {
                id: existing.id,
                text: existing.text,
                trans: sen.trans || existing.trans,  // 优先使用有翻译的版本
                origin: sen.origin || existing.origin  // 优先使用有来源的版本
            };
            map.set(sen.text, merged);
        }
    }

    // 重新分配 ID
    return [...map.values()].map((sen, index) => ({
        ...sen,
        id: index + 1
    }));
}