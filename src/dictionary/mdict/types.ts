/**
 * MDict 词典类型定义
 */

import { KeyWordItem } from "js-mdict";

/**
 * 词典查询结果
 */
export interface MdictSearchResult {
    word: string;
    definition: string | null;  // HTML 内容
    found: boolean;
}

/**
 * 模糊匹配/建议结果
 */
export interface MdictSuggestion {
    keyText: string;
    recordStartOffset: number;
    recordEndOffset: number;
}

/**
 * 词典信息
 */
export interface MdictInfo {
    fileName: string;
    filePath: string;
    title?: string;
    description?: string;
    loaded: boolean;
}

/**
 * 词典配置
 */
export interface MdictConfig {
    path: string;      // 词典文件路径
    enabled: boolean;  // 是否启用
}