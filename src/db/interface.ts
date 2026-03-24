/**
 * 数据库接口类型定义
 *
 * 本模块定义了插件中使用的所有数据结构：
 * - ArticleWords: 文章中的单词列表
 * - Word: 单词及其状态
 * - Phrase: 词组及其位置
 * - ExpressionInfo: 单词/词组的完整信息
 * - Sentence: 例句
 */

// 文章与其中包含的单词列表
interface ArticleWords {
    article: string;
    words: string[];
}

// 单词及其学习状态
// status: 0=Ignore, 1=Learning, 2=Familiar, 3=Known, 4=Learned
interface Word {
    text: string;
    status: number;
}

// 词组及其位置信息
interface Phrase {
    text: string;
    status: number;
    offset: number;  // 在文章中的字符偏移量
}

interface WordsPhrase {
    words: Word[];
    phrases: Phrase[];
}

interface Sentence {
    text: string;
    trans: string;
    origin: string;
}

interface ExpressionInfo {
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    notes: string[];
    sentences: Sentence[];
}

interface ExpressionInfoSimple {
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    note_num: number;
    sen_num: number;
    date: number;
}

interface CountInfo {
    word_count: number[];
    phrase_count: number[];
}


interface Span {
    from: number;
    to: number;
}

interface WordCount {
    today: number[];
    accumulated: number[];
}

// 热力图数据点：日期和学习数量
interface HeatmapData {
    date: string;        // 格式: YYYY-MM-DD
    count: number;       // 当日学习数量
    level: number;       // 强度等级 0-4
}

// 热力图统计信息（简化版）
interface HeatmapStats {
    totalDays: number;           // 总天数
    totalLearned: number;        // 总学习数
    longestStreak: number;       // 最长连续学习天数
    currentStreak: number;       // 当前连续学习天数
    data: HeatmapData[];         // 热力图数据
    startDate: string;           // 开始日期
    endDate: string;             // 结束日期
}


export type {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapData, HeatmapStats
};