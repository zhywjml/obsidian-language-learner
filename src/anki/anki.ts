/**
 * AnkiConnect API 封装
 *
 * 提供与 Anki 闪卡应用交互的接口
 * AnkiConnect 是一个 Anki 插件，提供 HTTP API (JSON-RPC)，默认端口 8765
 */

export interface AnkiNote {
    deckName: string;
    modelName: string;
    fields: { [key: string]: string };
    tags?: string[];
}

export interface AnkiCard {
    noteId: number;
    cards: number[];
}

export interface AnkiDeck {
    name: string;
    cards: number;
}

export interface AnkiModel {
    name: string;
    fields: { [key: string]: { name: string; ord: number } };
    templates: { name: string; }[];
}

/**
 * AnkiConnect API 客户端
 */
export class AnkiConnect {
    private host: string;
    private port: number;
    private apiKey: string;

    constructor(host: string = "127.0.0.1", port: number = 8765, apiKey: string = "") {
        this.host = host;
        this.port = port;
        this.apiKey = apiKey;
    }

    /**
     * 发送 JSON-RPC 请求到 AnkiConnect
     */
    private async request(action: string, params: any = {}): Promise<any> {
        const url = `http://${this.host}:${this.port}`;
        const body: any = {
            action,
            version: 5,
            params,
        };

        // 如果有 API key，添加到请求中
        if (this.apiKey) {
            body.key = this.apiKey;
        }

        console.log("AnkiConnect request:", JSON.stringify(body));

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();
        console.log("AnkiConnect response:", JSON.stringify(result));

        if (result.error) {
            throw new Error(result.error);
        }

        return result.result;
    }

    /**
     * 测试连接
     */
    async connect(): Promise<boolean> {
        try {
            await this.request("version");
            return true;
        } catch (e) {
            console.error("AnkiConnect connection failed:", e);
            return false;
        }
    }

    /**
     * 获取牌组列表
     */
    async getDeckNames(): Promise<string[]> {
        return await this.request("deckNames");
    }

    /**
     * 获取卡片模板列表
     */
    async getModelNames(): Promise<string[]> {
        return await this.request("modelNames");
    }

    /**
     * 获取模板字段信息
     */
    async getModelFieldNames(modelName: string): Promise<string[]> {
        const models = await this.request("modelFieldNames", { modelName });
        return models;
    }

    /**
     * 创建牌组
     */
    async createDeck(name: string): Promise<void> {
        await this.request("createDeck", { deck: name });
    }

    /**
     * 添加笔记（卡片）
     */
    async addNote(note: AnkiNote): Promise<number> {
        return await this.request("addNote", { note });
    }

    /**
     * 查找笔记
     */
    async findNotes(query: string): Promise<number[]> {
        return await this.request("findNotes", { query });
    }

    /**
     * 获取笔记信息
     */
    async getNotesInfo(noteIds: number[]): Promise<any[]> {
        return await this.request("notesInfo", { notes: noteIds });
    }

    /**
     * 更新笔记
     */
    async updateNote(noteId: number, fields: { [key: string]: string }): Promise<void> {
        await this.request("updateNoteFields", {
            note: noteId,
            fields,
        });
    }

    /**
     * 删除笔记
     */
    async deleteNotes(noteIds: number[]): Promise<void> {
        await this.request("deleteNotes", { notes: noteIds });
    }

    /**
     * 添加标签
     */
    async addTags(noteIds: number[], tags: string): Promise<void> {
        await this.request("addTags", { notes: noteIds, tags });
    }

    /**
     * 获取牌组信息
     */
    async getDeckInfo(deckName: string): Promise<any> {
        return await this.request("getDeckInfo", { deck: deckName });
    }

    /**
     * 检查并确保牌组存在
     */
    async ensureDeckExists(deckName: string): Promise<void> {
        const decks = await this.getDeckNames();
        if (!decks.includes(deckName)) {
            try {
                await this.createDeck(deckName);
            } catch (e) {
                // 牌组可能已存在，忽略错误
                console.warn("Deck creation warning:", e);
            }
        }
    }
}

export default AnkiConnect;