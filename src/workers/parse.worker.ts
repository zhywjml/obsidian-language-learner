/**
 * 文本解析 Web Worker
 * 在后台线程执行文本解析，避免阻塞 UI
 */

// Worker 消息类型
interface ParseRequestMessage {
    type: "PARSE_REQUEST";
    id: number;
    text: string;
    words: Array<{ text: string; status: number }>;
    phrases: Array<{ text: string; status: number; offset: number }>;
}

interface ParseResponseMessage {
    type: "PARSE_RESPONSE";
    id: number;
    html: string;
    error?: string;
}

// 简单 token 类型
interface Token {
    type: "word" | "punctuation" | "whitespace" | "other";
    text: string;
}

// 单词状态映射
const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];

// Worker 全局类型声明
interface WorkerGlobalScope {
    onmessage: ((this: WorkerGlobalScope, ev: MessageEvent) => void) | null;
    postMessage(message: any): void;
}
declare const self: WorkerGlobalScope;

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 简单分词
 */
function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    const regex = /([a-zA-Z]+)|(\s+)|([0-9\u4e00-\u9fa5]+)|(.)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            tokens.push({ type: "word", text: match[1] });
        } else if (match[2]) {
            tokens.push({ type: "whitespace", text: match[2] });
        } else if (match[3]) {
            tokens.push({ type: "other", text: match[3] });
        } else {
            tokens.push({ type: "punctuation", text: match[4] });
        }
    }

    return tokens;
}

/**
 * 包裹单个 token
 */
function wrapToken(
    token: Token,
    wordStatusMap: Map<string, number>
): string {
    if (token.type === "whitespace") {
        return token.text;
    }

    if (token.type === "other") {
        return `<span class="other">${escapeHtml(token.text)}</span>`;
    }

    if (token.type === "punctuation") {
        return escapeHtml(token.text);
    }

    // word 类型
    const lowerText = token.text.toLowerCase();
    const status = wordStatusMap.has(lowerText)
        ? STATUS_MAP[wordStatusMap.get(lowerText)!]
        : "new";

    return `<span class="word ${status}">${escapeHtml(token.text)}</span>`;
}

/**
 * 分词并包裹 HTML
 */
function tokenizeAndWrap(
    text: string,
    wordStatusMap: Map<string, number>,
    phraseSet: Set<string>
): string {
    const tokens = tokenize(text);
    const result: string[] = [];

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];

        // 尝试匹配短语（从最长可能开始）
        let phraseMatched = false;
        const maxPhraseLen = Math.min(10, tokens.length - i);

        for (let len = maxPhraseLen; len > 1; len--) {
            const candidateTokens = tokens.slice(i, i + len);
            const candidate = candidateTokens
                .filter(t => t.type === "word")
                .map(t => t.text.toLowerCase())
                .join(" ");

            if (phraseSet.has(candidate)) {
                // 找到短语，包裹 phrase span
                const phraseHtml = candidateTokens
                    .map(t => wrapToken(t, wordStatusMap))
                    .join("");
                result.push(`<span class="phrase learning">${phraseHtml}</span>`);
                i += len;
                phraseMatched = true;
                break;
            }
        }

        if (!phraseMatched) {
            // 普通 token
            result.push(wrapToken(token, wordStatusMap));
            i++;
        }
    }

    return result.join("");
}

/**
 * 处理 Markdown 图片
 */
function processMarkdownImage(paragraph: string): string {
    const match = paragraph.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (!match) return `<p>${escapeHtml(paragraph)}</p>`;

    const alt = escapeHtml(match[1]);
    const src = escapeHtml(match[2]);
    return `<div style="text-align:center"><div style="display:inline-block"><img alt="${alt}" src="${src}"></div></div>`;
}

/**
 * 主解析函数
 */
function parseText(
    text: string,
    words: Array<{ text: string; status: number }>,
    phrases: Array<{ text: string; status: number; offset: number }>
): string {
    // 创建单词状态查找表
    const wordStatusMap = new Map<string, number>();
    for (const word of words) {
        wordStatusMap.set(word.text.toLowerCase(), word.status);
    }

    // 创建短语查找表（空格分隔）
    const phraseSet = new Set<string>();
    for (const phrase of phrases) {
        phraseSet.add(phrase.text.toLowerCase());
    }

    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    const result: string[] = [];

    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;

        // 检查是否是 Markdown 图片语法
        if (paragraph.match(/^!\[.*?\]\(.*?\)$/)) {
            result.push(processMarkdownImage(paragraph));
            continue;
        }

        // 检查是否是标题
        const headerMatch = paragraph.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const content = tokenizeAndWrap(headerMatch[2], wordStatusMap, phraseSet);
            result.push(`<h${level}><span class="stns">${content}</span></h${level}>`);
            continue;
        }

        // 普通段落
        const content = tokenizeAndWrap(paragraph, wordStatusMap, phraseSet);
        result.push(`<p>${content}</p>`);
    }

    return result.join("");
}

/**
 * Worker 消息处理
 */
self.onmessage = function (e: MessageEvent<ParseRequestMessage>) {
    const { id, text, words, phrases } = e.data;

    try {
        const html = parseText(text, words, phrases);
        const response: ParseResponseMessage = {
            type: "PARSE_RESPONSE",
            id,
            html
        };
        self.postMessage(response);
    } catch (err) {
        const response: ParseResponseMessage = {
            type: "PARSE_RESPONSE",
            id,
            html: "",
            error: err instanceof Error ? err.message : String(err)
        };
        self.postMessage(response);
    }
};

export {};
