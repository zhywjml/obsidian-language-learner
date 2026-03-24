/**
 * 智能复习系统类型定义
 * 基于SM-2间隔重复算法
 */

// 复习卡片类型
export type CardType = "word" | "sentence";

// 复习卡片
export interface ReviewCard {
    id: string;                    // 唯一标识 (UUID)
    type: CardType;                // 卡片类型

    // 卡片内容
    front: string;                 // 正面内容
    back: string;                  // 反面内容

    // 单词特有字段
    word?: string;                 // 单词原文
    pronunciation?: string;        // 音标
    meaning?: string;              // 释义

    // 句子特有字段
    sentence?: string;             // 完整句子
    translation?: string;          // 翻译
    highlightedWords?: string[];   // 需要高亮的单词

    // SM-2算法数据
    interval: number;              // 当前间隔天数 (默认0)
    easeFactor: number;            // 难易度系数 (默认2.5)
    repetitions: number;           // 连续成功次数 (默认0)
    nextReviewDate: string;        // 下次复习日期 YYYY-MM-DD
    lastReviewDate?: string;       // 上次复习日期

    // 统计
    totalReviews: number;          // 总复习次数
    correctCount: number;          // 正确次数 (rating >= 3)
    wrongCount: number;            // 错误次数 (rating < 3)

    // 元数据
    createdAt: string;             // 创建时间
    tags: string[];                // 标签
    source?: string;               // 来源文章/单词
    expressionId?: string;         // 关联的单词/短语ID
}

// 复习质量评分 (SM-2算法)
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0=完全忘记, 1=几乎忘记, 2=勉强想起, 3=正确但犹豫, 4=正确且流畅, 5=完美

// 复习设置
export interface ReviewSettings {
    // 默认模式
    defaultMode: "word" | "sentence" | "mixed";

    // 单词卡片模板
    wordCardTemplate: {
        front: ("word" | "pronunciation")[];
        back: ("meaning" | "sentence")[];
    };

    // 句子卡片模板
    sentenceCardTemplate: {
        front: ("sentence" | "translation")[];
        back: ("translation" | "sentence")[];
        highlightStyle: "bold" | "underline" | "color" | "none";
        highlightColor?: string;  // 如 "#ff0000"
    };

    // 每日学习量
    dailyNewCards: number;         // 每日新卡片上限 (默认10)
    dailyReviewCards: number;      // 每日复习上限 (默认50)

    // 算法参数
    algorithm: "sm2";              // 算法类型 (预留扩展)
    easyBonus: number;             // Easy奖励系数 (默认1.3)
    hardInterval: number;          // Hard间隔系数 (默认1.2)
    lapseInterval: number;         // 遗忘后间隔 (默认1)

    // 界面设置
    showAnswerButton: boolean;     // 显示"显示答案"按钮 (默认true)
    autoPlayAudio: boolean;        // 自动播放发音 (默认false)
}

// 复习进度/统计
export interface ReviewProgress {
    date: string;                  // 日期 YYYY-MM-DD
    newCards: number;              // 新学习卡片数
    reviewCards: number;           // 复习卡片数
    correctCount: number;          // 正确数
    wrongCount: number;            // 错误数
    timeSpent: number;             // 学习时长(秒)
}

// 每日复习队列
export interface DailyQueue {
    date: string;                  // 日期
    newCards: ReviewCard[];        // 新卡片队列
    reviewCards: ReviewCard[];     // 复习卡片队列
    completed: string[];           // 已完成卡片ID
}

// 卡片筛选条件
export interface CardFilter {
    type?: CardType;
    status?: "new" | "learning" | "review" | "mastered";
    tags?: string[];
    source?: string;
    dateRange?: { from: string; to: string };
}

// 默认设置
export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
    defaultMode: "mixed",
    wordCardTemplate: {
        front: ["word"],
        back: ["meaning"]
    },
    sentenceCardTemplate: {
        front: ["sentence"],
        back: ["translation"],
        highlightStyle: "bold"
    },
    dailyNewCards: 10,
    dailyReviewCards: 50,
    algorithm: "sm2",
    easyBonus: 1.3,
    hardInterval: 1.2,
    lapseInterval: 1,
    showAnswerButton: true,
    autoPlayAudio: false
};
