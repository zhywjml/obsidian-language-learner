/**
 * 卡片调度器
 * 生成每日复习队列
 */

import { ReviewDb } from "@/db/review_db";
import { ReviewCard, DailyQueue, ReviewSettings, DEFAULT_REVIEW_SETTINGS } from "@/db/review_interface";
import { ExpressionInfo } from "@/db/interface";

export class CardScheduler {
    private db: ReviewDb;

    constructor(db: ReviewDb) {
        this.db = db;
    }

    /**
     * 生成今日复习队列
     */
    async generateDailyQueue(date?: string): Promise<DailyQueue> {
        const targetDate = date || new Date().toISOString().split('T')[0];

        // 检查是否已生成
        const existing = await this.db.getDailyQueue(targetDate);
        if (existing) {
            return existing;
        }

        const settings = await this.db.getSettings() || DEFAULT_REVIEW_SETTINGS;
        const allCards = await this.db.getCards();

        // 分离新卡片和复习卡片
        const newCards: ReviewCard[] = [];
        const reviewCards: ReviewCard[] = [];

        for (const card of allCards) {
            if (card.repetitions === 0) {
                // 新卡片
                if (newCards.length < settings.dailyNewCards) {
                    newCards.push(card);
                }
            } else if (card.nextReviewDate <= targetDate) {
                // 到期的复习卡片
                reviewCards.push(card);
            }
        }

        // 限制复习卡片数量
        const limitedReviewCards = reviewCards.slice(0, settings.dailyReviewCards);

        const queue: DailyQueue = {
            date: targetDate,
            newCards,
            reviewCards: limitedReviewCards,
            completed: []
        };

        await this.db.saveDailyQueue(queue);
        return queue;
    }

    /**
     * 从现有单词库导入卡片
     */
    async importFromExpressions(expressions: ExpressionInfo[]): Promise<number> {
        const cards = await this.db.getCards();
        let imported = 0;

        for (const expr of expressions) {
            // 检查是否已存在
            const exists = cards.some(c => c.expressionId === expr.expression);
            if (exists) continue;

            // 只导入学习中及以上的单词
            if (expr.status < 1) continue;

            // 创建单词卡片
            await this.db.addCard({
                type: "word",
                front: expr.expression,
                back: expr.meaning || "",
                word: expr.expression,
                meaning: expr.meaning,
                interval: 0,
                easeFactor: 2.5,
                repetitions: 0,
                nextReviewDate: new Date().toISOString().split('T')[0],
                totalReviews: 0,
                correctCount: 0,
                wrongCount: 0,
                tags: expr.tags || [],
                source: "Imported from word database",
                expressionId: expr.expression
            });

            imported++;
        }

        return imported;
    }

    /**
     * 标记卡片为已完成
     */
    async markCompleted(cardId: string, date?: string): Promise<void> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const queue = await this.db.getDailyQueue(targetDate);
        if (queue && !queue.completed.includes(cardId)) {
            queue.completed.push(cardId);
            await this.db.saveDailyQueue(queue);
        }
    }

    /**
     * 获取剩余待复习卡片
     */
    async getRemainingCards(date?: string): Promise<{
        newCards: ReviewCard[];
        reviewCards: ReviewCard[];
        total: number;
    }> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const queue = await this.db.getDailyQueue(targetDate);

        if (!queue) {
            return { newCards: [], reviewCards: [], total: 0 };
        }

        const remainingNew = queue.newCards.filter(
            c => !queue.completed.includes(c.id)
        );
        const remainingReview = queue.reviewCards.filter(
            c => !queue.completed.includes(c.id)
        );

        return {
            newCards: remainingNew,
            reviewCards: remainingReview,
            total: remainingNew.length + remainingReview.length
        };
    }

    /**
     * 获取今日学习统计
     */
    async getTodayStats(date?: string): Promise<{
        newTotal: number;
        newCompleted: number;
        reviewTotal: number;
        reviewCompleted: number;
    }> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const queue = await this.db.getDailyQueue(targetDate);

        if (!queue) {
            return { newTotal: 0, newCompleted: 0, reviewTotal: 0, reviewCompleted: 0 };
        }

        return {
            newTotal: queue.newCards.length,
            newCompleted: queue.newCards.filter(c => queue.completed.includes(c.id)).length,
            reviewTotal: queue.reviewCards.length,
            reviewCompleted: queue.reviewCards.filter(c => queue.completed.includes(c.id)).length
        };
    }
}
