# 智能复习系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于SM-2间隔重复算法的智能复习系统，支持单词和句子两种卡片模式，用户可自定义正反面内容。

**Architecture:**
- 数据层：使用JSON文件存储在`Language Learner/Review/`目录，包括复习卡片、复习进度和用户设置
- 算法层：实现SM-2间隔重复算法，计算下次复习时间和难易度系数
- 界面层：创建复习面板视图，支持卡片翻转、难度评分和设置配置
- 集成层：从现有单词库自动导入卡片，与主数据库同步状态

**Tech Stack:** TypeScript, Vue 3, Obsidian API, JSON文件存储

---

## 文件结构概览

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/db/review_interface.ts` | 复习系统类型定义 | 创建 |
| `src/db/review_db.ts` | 复习数据管理（JSON读写） | 创建 |
| `src/review/sm2.ts` | SM-2间隔重复算法 | 创建 |
| `src/review/card_scheduler.ts` | 卡片调度器（生成每日队列） | 创建 |
| `src/views/ReviewPanelView.ts` | 复习面板视图注册 | 创建 |
| `src/views/ReviewPanel.vue` | 复习面板UI组件 | 创建 |
| `src/views/ReviewSettings.vue` | 复习设置面板 | 创建 |
| `src/views/LearnPanelView.ts` | 修改以添加复习入口 | 修改 |
| `src/plugin.ts` | 注册复习视图和按钮 | 修改 |

---

## Phase 1: 数据类型定义

### Task 1.1: 创建复习系统类型接口

**Files:**
- Create: `src/db/review_interface.ts`

- [ ] **Step 1: 定义复习卡片接口**

创建 `src/db/review_interface.ts`：

```typescript
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
```

- [ ] **Step 2: 验证类型定义编译**

运行：
```bash
npx tsc src/db/review_interface.ts --noEmit --skipLibCheck
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/db/review_interface.ts
git commit -m "feat(review): 添加复习系统类型定义

- ReviewCard 卡片接口
- ReviewSettings 设置接口
- ReviewProgress 进度接口
- DailyQueue 每日队列接口
- 默认设置常量"
```

---

## Phase 2: SM-2算法实现

### Task 2.1: 实现SM-2间隔重复算法

**Files:**
- Create: `src/review/sm2.ts`

- [ ] **Step 1: 创建SM-2算法模块**

创建 `src/review/sm2.ts`：

```typescript
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
export function isNewCard(repetitions: number): boolean {
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
```

- [ ] **Step 2: Commit**

```bash
git add src/review/sm2.ts
git commit -m "feat(review): 实现SM-2间隔重复算法

- calculateNextReview 核心算法
- getQualityFromButton 评分转换
- getButtonInterval 间隔提示
- getCardStatus 状态判断"
```

---

## Phase 3: 数据管理

### Task 3.1: 创建复习数据库管理类

**Files:**
- Create: `src/db/review_db.ts`

- [ ] **Step 1: 创建ReviewDb类**

创建 `src/db/review_db.ts`：

```typescript
/**
 * 复习数据管理类
 * 使用JSON文件存储在 Language Learner/Review/ 目录
 */

import { TFile, TFolder, Vault, normalizePath } from "obsidian";
import {
    ReviewCard,
    ReviewSettings,
    ReviewProgress,
    DailyQueue,
    CardFilter,
    DEFAULT_REVIEW_SETTINGS
} from "./review_interface";
import { nanoid } from "nanoid";

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
            id: nanoid(),
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
```

注意：需要添加 nanoid 依赖或使用内置方法生成ID。让我修改使用简单的方法：

```typescript
// 在类中添加私有方法替代nanoid
private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
```

然后将 `nanoid()` 替换为 `this.generateId()`。

- [ ] **Step 2: Commit**

```bash
git add src/db/review_db.ts
git commit -m "feat(review): 添加复习数据管理类

- ReviewDb 类管理JSON文件存储
- 卡片CRUD操作
- 设置和进度管理
- 每日队列管理
- 统计功能"
```

---

## Phase 4: 卡片调度器

### Task 4.1: 实现卡片调度器

**Files:**
- Create: `src/review/card_scheduler.ts`

- [ ] **Step 1: 创建卡片调度器**

创建 `src/review/card_scheduler.ts`：

```typescript
/**
 * 卡片调度器
 * 生成每日复习队列
 */

import { ReviewDb } from "@/db/review_db";
import { ReviewCard, DailyQueue, ReviewSettings } from "@/db/review_interface";
import { getCardStatus } from "./sm2";

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
}

import { ExpressionInfo } from "@/db/interface";
import { DEFAULT_REVIEW_SETTINGS } from "@/db/review_interface";
```

- [ ] **Step 2: Commit**

```bash
git add src/review/card_scheduler.ts
git commit -m "feat(review): 添加卡片调度器

- generateDailyQueue 生成每日队列
- importFromExpressions 从单词库导入
- markCompleted 标记完成
- getRemainingCards 获取剩余卡片"
```

---

由于计划较长，剩余部分（Phase 5-8）将在后续继续。需要我先执行已规划的Phase 1-4吗？