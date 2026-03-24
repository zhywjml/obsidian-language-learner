/**
 * 复习数据管理类
 * 使用JSON文件存储在 Language Learner/Review/ 目录
 */

import { TFile, Vault, normalizePath } from "obsidian";
import {
    ReviewCard,
    ReviewSettings,
    ReviewProgress,
    DailyQueue,
    CardFilter,
    DEFAULT_REVIEW_SETTINGS
} from "@/db/review_interface";

export class ReviewDb {
    private vault: Vault;
    private basePath: string;

    // 文件路径
    private get cardsPath(): string {
        return normalizePath(`${this.basePath}/review_cards.json`);
    }
    private get progressPath(): string {
        return normalizePath(`${this.basePath}/review_progress.json`);
    }
    private get settingsPath(): string {
        return normalizePath(`${this.basePath}/review_settings.json`);
    }
    private get queuePath(): string {
        return normalizePath(`${this.basePath}/daily_queue.json`);
    }

    constructor(vault: Vault, basePath: string) {
        this.vault = vault;
        this.basePath = normalizePath(`${basePath}/Language Learner/Review`);
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 初始化存储目录
     */
    async init(): Promise<void> {
        // 确保目录存在
        const folderPath = normalizePath(`${this.basePath}`);
        const folder = this.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.vault.createFolder(folderPath);
        }

        // 初始化默认设置
        const settings = await this.getSettings();
        if (!settings) {
            await this.saveSettings(DEFAULT_REVIEW_SETTINGS);
        }

        // 初始化空卡片数组
        const cards = await this.getCards();
        if (!cards) {
            await this.saveCards([]);
        }
    }

    // ========== 卡片操作 ==========

    /**
     * 获取所有卡片
     */
    async getCards(): Promise<ReviewCard[]> {
        try {
            const file = this.vault.getAbstractFileByPath(this.cardsPath);
            if (file instanceof TFile) {
                const content = await this.vault.read(file);
                return JSON.parse(content);
            }
        } catch (e) {
            console.error("[ReviewDb] Failed to load cards:", e);
        }
        return [];
    }

    /**
     * 保存所有卡片
     */
    async saveCards(cards: ReviewCard[]): Promise<void> {
        const content = JSON.stringify(cards, null, 2);
        const file = this.vault.getAbstractFileByPath(this.cardsPath);
        if (file instanceof TFile) {
            await this.vault.modify(file, content);
        } else {
            await this.vault.create(this.cardsPath, content);
        }
    }

    /**
     * 添加新卡片
     */
    async addCard(card: Omit<ReviewCard, "id" | "createdAt">): Promise<ReviewCard> {
        const cards = await this.getCards();
        const newCard: ReviewCard = {
            ...card,
            id: this.generateId(),
            createdAt: new Date().toISOString()
        };
        cards.push(newCard);
        await this.saveCards(cards);
        return newCard;
    }

    /**
     * 更新卡片
     */
    async updateCard(id: string, updates: Partial<ReviewCard>): Promise<ReviewCard | null> {
        const cards = await this.getCards();
        const index = cards.findIndex(c => c.id === id);
        if (index === -1) return null;

        cards[index] = { ...cards[index], ...updates };
        await this.saveCards(cards);
        return cards[index];
    }

    /**
     * 删除卡片
     */
    async deleteCard(id: string): Promise<boolean> {
        const cards = await this.getCards();
        const newCards = cards.filter(c => c.id !== id);
        if (newCards.length === cards.length) return false;
        await this.saveCards(newCards);
        return true;
    }

    /**
     * 根据ID获取卡片
     */
    async getCardById(id: string): Promise<ReviewCard | null> {
        const cards = await this.getCards();
        return cards.find(c => c.id === id) || null;
    }

    /**
     * 筛选卡片
     */
    async filterCards(filter: CardFilter): Promise<ReviewCard[]> {
        let cards = await this.getCards();

        if (filter.type) {
            cards = cards.filter(c => c.type === filter.type);
        }
        if (filter.tags && filter.tags.length > 0) {
            cards = cards.filter(c =>
                filter.tags!.some(tag => c.tags.includes(tag))
            );
        }
        if (filter.source) {
            cards = cards.filter(c => c.source === filter.source);
        }
        if (filter.dateRange) {
            cards = cards.filter(c =>
                c.createdAt >= filter.dateRange!.from &&
                c.createdAt <= filter.dateRange!.to
            );
        }

        return cards;
    }

    /**
     * 获取今日待复习卡片
     */
    async getDueCards(date?: string): Promise<ReviewCard[]> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const cards = await this.getCards();
        return cards.filter(c => c.nextReviewDate <= targetDate);
    }

    // ========== 设置操作 ==========

    async getSettings(): Promise<ReviewSettings | null> {
        try {
            const file = this.vault.getAbstractFileByPath(this.settingsPath);
            if (file instanceof TFile) {
                const content = await this.vault.read(file);
                return JSON.parse(content);
            }
        } catch (e) {
            console.error("[ReviewDb] Failed to load settings:", e);
        }
        return null;
    }

    async saveSettings(settings: ReviewSettings): Promise<void> {
        const content = JSON.stringify(settings, null, 2);
        const file = this.vault.getAbstractFileByPath(this.settingsPath);
        if (file instanceof TFile) {
            await this.vault.modify(file, content);
        } else {
            await this.vault.create(this.settingsPath, content);
        }
    }

    // ========== 进度操作 ==========

    async getProgress(): Promise<ReviewProgress[]> {
        try {
            const file = this.vault.getAbstractFileByPath(this.progressPath);
            if (file instanceof TFile) {
                const content = await this.vault.read(file);
                return JSON.parse(content);
            }
        } catch (e) {
            console.error("[ReviewDb] Failed to load progress:", e);
        }
        return [];
    }

    async saveProgress(progress: ReviewProgress[]): Promise<void> {
        const content = JSON.stringify(progress, null, 2);
        const file = this.vault.getAbstractFileByPath(this.progressPath);
        if (file instanceof TFile) {
            await this.vault.modify(file, content);
        } else {
            await this.vault.create(this.progressPath, content);
        }
    }

    async addProgress(progress: ReviewProgress): Promise<void> {
        const progresses = await this.getProgress();
        const existingIndex = progresses.findIndex(p => p.date === progress.date);
        if (existingIndex >= 0) {
            progresses[existingIndex] = progress;
        } else {
            progresses.push(progress);
        }
        await this.saveProgress(progresses);
    }

    // ========== 每日队列操作 ==========

    async getDailyQueue(date?: string): Promise<DailyQueue | null> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        try {
            const file = this.vault.getAbstractFileByPath(this.queuePath);
            if (file instanceof TFile) {
                const content = await this.vault.read(file);
                const queues: DailyQueue[] = JSON.parse(content);
                return queues.find(q => q.date === targetDate) || null;
            }
        } catch (e) {
            console.error("[ReviewDb] Failed to load queue:", e);
        }
        return null;
    }

    async saveDailyQueue(queue: DailyQueue): Promise<void> {
        let queues: DailyQueue[] = [];
        try {
            const file = this.vault.getAbstractFileByPath(this.queuePath);
            if (file instanceof TFile) {
                const content = await this.vault.read(file);
                queues = JSON.parse(content);
            }
        } catch (e) {
            // 文件不存在，使用空数组
        }

        const existingIndex = queues.findIndex(q => q.date === queue.date);
        if (existingIndex >= 0) {
            queues[existingIndex] = queue;
        } else {
            queues.push(queue);
        }

        const content = JSON.stringify(queues, null, 2);
        const file = this.vault.getAbstractFileByPath(this.queuePath);
        if (file instanceof TFile) {
            await this.vault.modify(file, content);
        } else {
            await this.vault.create(this.queuePath, content);
        }
    }

    // ========== 统计 ==========

    async getStats(): Promise<{
        total: number;
        new: number;
        learning: number;
        review: number;
        mastered: number;
        dueToday: number;
    }> {
        const cards = await this.getCards();
        const today = new Date().toISOString().split('T')[0];

        return {
            total: cards.length,
            new: cards.filter(c => c.repetitions === 0).length,
            learning: cards.filter(c => c.interval > 0 && c.interval < 21).length,
            review: cards.filter(c => c.interval >= 21 && c.interval < 90).length,
            mastered: cards.filter(c => c.interval >= 90).length,
            dueToday: cards.filter(c => c.nextReviewDate <= today).length
        };
    }
}
