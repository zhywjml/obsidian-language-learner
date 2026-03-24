/**
 * SM-2 间隔重复算法实现
 * 参考: SuperMemo-2算法
 */

import { ReviewQuality } from "@/db/review_interface";

export interface SM2Result {
    interval: number;        // 新间隔天数
    repetitions: number;     // 新连续成功次数
    easeFactor: number;      // 新难易度系数
    nextReviewDate: string;  // 下次复习日期 (YYYY-MM-DD)
}

export interface SM2Input {
    quality: ReviewQuality;  // 复习质量评分 (0-5)
    interval: number;        // 当前间隔天数
    repetitions: number;     // 当前连续成功次数
    easeFactor: number;      // 当前难易度系数
}

/**
 * 计算下次复习时间
 * @param input SM-2输入参数
 * @returns SM-2计算结果
 */
export function calculateNextReview(input: SM2Input): SM2Result {
    const { quality, interval, repetitions, easeFactor } = input;

    // 计算新的难易度系数
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // 确保EF >= 1.3
    if (newEaseFactor < 1.3) {
        newEaseFactor = 1.3;
    }

    let newInterval: number;
    let newRepetitions: number;

    if (quality < 3) {
        // 如果质量<3（忘记或几乎忘记），重置间隔
        newRepetitions = 0;
        newInterval = 1;  // 1天后复习
    } else {
        // 成功回忆
        newRepetitions = repetitions + 1;

        if (newRepetitions === 1) {
            // 第一次成功，1天后复习
            newInterval = 1;
        } else if (newRepetitions === 2) {
            // 第二次成功，6天后复习
            newInterval = 6;
        } else {
            // 第三次及以上，使用之前的间隔乘以EF
            newInterval = Math.round(interval * easeFactor);
        }
    }

    // 计算下次复习日期
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);
    const nextReviewDate = nextDate.toISOString().split('T')[0];

    return {
        interval: newInterval,
        repetitions: newRepetitions,
        easeFactor: newEaseFactor,
        nextReviewDate
    };
}

/**
 * 根据评分按钮快速获取quality值
 */
export function getQualityFromButton(
    button: "again" | "hard" | "good" | "easy"
): ReviewQuality {
    switch (button) {
        case "again": return 0;  // 完全忘记
        case "hard": return 2;   // 勉强想起
        case "good": return 4;   // 正确且流畅
        case "easy": return 5;   // 完美
        default: return 3;
    }
}

/**
 * 获取按钮对应的间隔提示
 */
export function getButtonInterval(
    button: "again" | "hard" | "good" | "easy",
    currentInterval: number,
    easeFactor: number
): string {
    switch (button) {
        case "again":
            return "< 1m";  // 1分钟内复习
        case "hard": {
            // Hard间隔通常是当前间隔的1.2倍，但至少1天
            const interval = Math.max(1, Math.round(currentInterval * 1.2));
            return interval === 1 ? "1d" : `${interval}d`;
        }
        case "good": {
            // Good使用正常计算
            if (currentInterval === 0) return "1d";
            const newInterval = Math.round(currentInterval * easeFactor);
            return newInterval === 1 ? "1d" : `${newInterval}d`;
        }
        case "easy": {
            // Easy间隔是Good的1.3倍
            const goodInterval = Math.round(currentInterval * easeFactor);
            const easyInterval = Math.round(goodInterval * 1.3);
            return easyInterval === 1 ? "1d" : `${easyInterval}d`;
        }
        default:
            return "?";
    }
}

/**
 * 判断卡片是否为新卡片
 */
export function isNewCard(repetitions: number, interval: number): boolean {
    return repetitions === 0 && interval === 0;
}

/**
 * 判断卡片学习状态
 */
export function getCardStatus(
    repetitions: number,
    interval: number
): "new" | "learning" | "review" | "mastered" {
    if (repetitions === 0) return "new";
    if (interval < 21) return "learning";  // 小于21天视为学习中
    if (interval < 90) return "review";    // 小于90天视为复习中
    return "mastered";                      // 大于90天视为已掌握
}
