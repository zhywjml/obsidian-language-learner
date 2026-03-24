import { unified, Processor } from "unified";
import retextEnglish from "retext-english";
import { Root, Content, Literal, Parent, Sentence } from "nlcst";
import { modifyChildren } from "unist-util-modify-children";
import { visit } from "unist-util-visit";
import { toString } from "nlcst-to-string";
import { imgnum } from "@/plugin";

import { Phrase, Word } from "@/db/interface";
import Plugin from "@/plugin";
import { hashString } from "@/utils/helpers";
import { getParseWorker, disposeParseWorker } from "@/utils/parseWorker";

// 单词状态映射：索引 -> CSS类名
const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];
type AnyNode = Root | Content | Content[];

/**
 * 解析结果缓存
 * key: 文章内容的哈希值
 * value: 解析后的HTML
 */
const parseCache = new Map<string, string>();

/**
 * 获取缓存的解析结果
 */
export function getCachedParseResult(text: string): string | null {
    const hash = hashString(text);
    return parseCache.get(hash) || null;
}

/**
 * 缓存解析结果
 */
export function cacheParseResult(text: string, html: string): void {
    const hash = hashString(text);
    parseCache.set(hash, html);

    // 限制缓存大小，防止内存泄漏
    if (parseCache.size > 100) {
        const firstKey = parseCache.keys().next().value;
        parseCache.delete(firstKey);
    }
}

/**
 * 清除解析缓存
 */
export function clearParseCache(): void {
    parseCache.clear();
}

// AST 解析结果缓存
const astCache = new Map<string, Root>();

/**
 * 获取缓存的 AST
 */
export function getCachedAST(text: string): Root | null {
    const hash = hashString(text);
    return astCache.get(hash) || null;
}

/**
 * 缓存 AST
 */
export function cacheAST(text: string, ast: Root): void {
    const hash = hashString(text);
    astCache.set(hash, ast);

    // 限制缓存大小
    if (astCache.size > 50) {
        const firstKey = astCache.keys().next().value;
        astCache.delete(firstKey);
    }
}

/**
 * 清除 AST 缓存
 */
export function clearASTCache(): void {
    astCache.clear();
}

/**
 * 文本解析器
 *
 * 使用 unified/retext 处理英文文本：
 * 1. 将文本解析为 AST（抽象语法树）
 * 2. 识别已记录的词组并标记
 * 3. 将 AST 转换为 HTML，每个单词包裹在 span 标签中
 * 4. 渲染 Markdown 语法（标题、粗斜体、图片等）
 *
 * 生成的 HTML 用于阅读视图，单词根据状态有不同的 CSS 类名
 */
export class TextParser {
    // 记录短语位置
    phrases: Phrase[] = [];
    // 记录单词状态
    words: Map<string, Word> = new Map<string, Word>();
    pIdx: number = 0;           // 短语处理索引
    plugin: Plugin;
    processor: Processor;       // unified 处理器

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.processor = unified()
            .use(retextEnglish)
            .use(this.addPhrases())
            .use(this.stringfy2HTML());
    }

    /**
     * 解析文本为 HTML
     * 使用缓存避免重复解析
     * @param data 文本内容
     * @param options 解析选项
     */
    async parse(data: string, options?: { useWorker?: boolean }): Promise<string> {
        // 检查缓存
        const cached = getCachedParseResult(data);
        if (cached) {
            return cached;
        }

        // 如果启用 Worker 且文本较长，使用 Worker 解析
        if (options?.useWorker && data.length > 2000) {
            try {
                const html = await this.parseWithWorker(data);
                cacheParseResult(data, html);
                return html;
            } catch (err) {
                console.warn("[TextParser] Worker parse failed, falling back to main thread:", err);
                // 继续执行主线程解析
            }
        }

        // 先处理 Markdown 语法（在原始文本上处理）
        let processedData = this.preprocessMarkdown(data.trim());
        let newHTML = await this.text2HTML(processedData);
        let html = this.processContentOptimized(newHTML);

        // 缓存结果
        cacheParseResult(data, html);

        return html;
    }

    /**
     * 使用 Web Worker 解析文本
     */
    private async parseWithWorker(data: string): Promise<string> {
        // 预处理 Markdown
        let processedData = this.preprocessMarkdown(data.trim());

        // 获取单词和短语数据
        this.pIdx = 0;
        this.words.clear();

        this.phrases = (
            await this.plugin.db.getStoredWords({
                article: processedData.toLowerCase(),
                words: [],
            })
        ).phrases;

        // 提取单词列表
        let wordSet: Set<string> = new Set();
        // 简单提取单词（基于空格和标点分割）
        const tokens = processedData.split(/[\s\.,!?;:]+/);
        for (const token of tokens) {
            const clean = token.trim().toLowerCase();
            if (clean && /^[a-z]+$/.test(clean)) {
                wordSet.add(clean);
            }
        }

        // 查询这些单词的 status
        let stored = await this.plugin.db.getStoredWords({
            article: "",
            words: [...wordSet],
        });

        // 使用 Worker 解析
        const worker = getParseWorker();
        const html = await worker.parse(processedData, stored.words, this.phrases);

        return html;
    }

    /**
     * 预处理 Markdown 语法（在原始文本上处理）
     * 处理 Obsidian wikilink 链接格式
     */
    private preprocessMarkdown(text: string): string {
        // 处理 Obsidian 图片 wikilink 格式: ![[image.jpg]] 转换为 ![image](image.jpg)
        // 注意：转换后的图片前后需要空行，以确保正确分段
        text = text.replace(/!\[\[([^\]|]+)\]\]/g, (match, path) => {
            const filename = path.split('/').pop();
            return `\n\n![${filename}](${path})\n\n`;
        });

        // 处理 Obsidian wikilink 格式（非图片）: [[link]] 或 [[link|text]]
        text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, text) => {
            return text || link;
        });

        return text;
    }

    /**
     * 处理 Markdown 语法
     * 支持：多级标题、粗体、斜体、删除线、图片
     */
    processContent(htmlContent: string): string {
        // 渲染 Markdown 图片 ![alt](url) - 优先处理以避免与其他格式冲突
        htmlContent = htmlContent.replace(/<p>(?=.*!)(?=.*\[)(?=.*\])(?=.*\()(?=.*\)).*<\/p>/g, (match) => {
            const pattern = /!\[(.*?)\]\((.*?)\)/;
            const str = match.replace(/<[^>]+>/g, '');
            const tq = pattern.exec(str);
            if (tq) {
                const altText = tq[1];
                const srcUrl = tq[2];

                // 创建图片容器（居中显示）
                const imgContainer = document.createElement('div');
                imgContainer.style.textAlign = 'center';
                const imgWrapper = document.createElement('div');
                imgWrapper.style.display = 'inline-block';
                const img = document.createElement('img');
                img.alt = altText;

                // 处理图片路径
                if (/^https?:\/\//.test(srcUrl)) {
                    // 网络图片直接使用
                    img.src = srcUrl;
                } else if (imgnum) {
                    // 本地图片：使用 Obsidian 的资源路径格式
                    // 参考项目的路径拼接算法：
                    // 1. 提取 srcUrl 的前3个字符作为前缀
                    // 2. 在 imgnum 中查找该前缀
                    // 3. 如果找到且前面是'/'，则截断 imgnum 并拼接
                    const str1 = imgnum;
                    const str2 = srcUrl;
                    const prefix = str2.substring(0, 3);
                    const index = str1.indexOf(prefix);

                    if (index !== -1 && index !== 0 && str1.charAt(index - 1) === '/') {
                        // 找到匹配前缀，截断并拼接
                        const firstPart = str1.substring(0, index);
                        img.src = firstPart + str2;
                    } else {
                        // 无匹配前缀，直接拼接
                        img.src = str1 + str2;
                    }
                } else {
                    img.src = srcUrl;
                }

                imgWrapper.appendChild(img);
                imgContainer.appendChild(imgWrapper);
                return imgContainer.outerHTML;
            }
            return match;
        });
        // 渲染多级标题 - 保留 span 标签内的内容
        htmlContent = htmlContent.replace(
            /(<span class="stns">)# (.*?)(<\/span>)(?=\s*<\/p>)/g,
            '<h1>$1$2$3</h1>'
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)## (.*?)(<\/span>)(?=\s*<\/p>)/g,
            '<h2>$1$2$3</h2>'
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            '<h3>$1$2$3</h3>'
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)#### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            '<h4>$1$2$3</h4>'
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)##### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            '<h5>$1$2$3</h5>'
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)###### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            '<h6>$1$2$3</h6>'
        );

        // 渲染粗体 **text** 或 __text__
        // 支持多个单词（多个span）的粗体
        htmlContent = htmlContent.replace(
            /\*\*((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)\*\*/g,
            '<b>$1</b>'
        );
        htmlContent = htmlContent.replace(
            /__((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)__/g,
            '<b>$1</b>'
        );

        // 渲染斜体 *text* 或 _text_
        // 注意：单个 * 和 _ 可能与粗体冲突，需要确保不是成对出现
        htmlContent = htmlContent.replace(
            /(?<!\*)\*(?!\*)((?:<span[^>]*>.*?<\/span>|\s|<[^>]+)+)\*(?!\*)/g,
            '<i>$1</i>'
        );
        htmlContent = htmlContent.replace(
            /(?<!_)_(?!_)((?:<span[^>]*>.*?<\/span>|\s|<[^>]+)+)_(?!_)/g,
            '<i>$1</i>'
        );

        // 渲染删除线 ~~text~~
        htmlContent = htmlContent.replace(
            /~~((?:<span[^>]*>.*?<\/span>|\s|<[^>]+)+)~~/g,
            '<del>$1</del>'
        );

        return htmlContent;
    }

    /**
     * 优化版 Markdown 语法处理
     * 使用单次遍历处理所有语法，减少正则替换次数
     */
    processContentOptimized(htmlContent: string): string {
        // 将内容分割为段落处理
        const lines = htmlContent.split('\n');
        const result: string[] = [];

        for (const line of lines) {
            if (!line.trim()) {
                result.push(line);
                continue;
            }

            // 处理段落级别的转换
            const processedLine = this.processLine(line);
            result.push(processedLine);
        }

        return result.join('\n');
    }

    /**
     * 处理单行内容
     */
    private processLine(line: string): string {
        // 检查是否是图片段落
        const imgMatch = line.match(/<p>(?=.*!)(?=.*\[)(?=.*\])(?=.*\()(?=.*\)).*<\/p>/);
        if (imgMatch) {
            return this.processImage(line);
        }

        // 检查是否是标题
        const headerMatch = line.match(/(<span class="stns">)(#{1,6})\s+(.*?)(<\/span>)(?=\s*<\/p>)/);
        if (headerMatch) {
            const level = headerMatch[2].length;
            return `<h${level}>${headerMatch[1]}${headerMatch[3]}${headerMatch[4]}</h${level}>`;
        }

        // 处理行内格式（粗体、斜体、删除线）
        return this.processInlineFormatting(line);
    }

    /**
     * 处理图片
     */
    private processImage(line: string): string {
        const pattern = /!\[(.*?)\]\((.*?)\)/;
        const str = line.replace(/<[^>]+>/g, '');
        const tq = pattern.exec(str);
        if (tq) {
            const altText = tq[1];
            const srcUrl = tq[2];

            // 创建图片容器（居中显示）
            const imgContainer = document.createElement('div');
            imgContainer.style.textAlign = 'center';
            const imgWrapper = document.createElement('div');
            imgWrapper.style.display = 'inline-block';
            const img = document.createElement('img');
            img.alt = altText;

            // 处理图片路径
            if (/^https?:\/\//.test(srcUrl)) {
                img.src = srcUrl;
            } else if (imgnum) {
                const str1 = imgnum;
                const str2 = srcUrl;
                const prefix = str2.substring(0, 3);
                const index = str1.indexOf(prefix);

                if (index !== -1 && index !== 0 && str1.charAt(index - 1) === '/') {
                    const firstPart = str1.substring(0, index);
                    img.src = firstPart + str2;
                } else {
                    img.src = str1 + str2;
                }
            } else {
                img.src = srcUrl;
            }

            imgWrapper.appendChild(img);
            imgContainer.appendChild(imgWrapper);
            return imgContainer.outerHTML;
        }
        return line;
    }

    /**
     * 处理行内格式（粗体、斜体、删除线）
     */
    private processInlineFormatting(html: string): string {
        // 使用单次遍历处理所有行内格式
        // 优先级：删除线 > 粗体 > 斜体

        // 删除线 ~~text~~
        html = html.replace(
            /~~((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)~~/g,
            '<del>$1</del>'
        );

        // 粗体 **text**
        html = html.replace(
            /\*\*((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)\*\*/g,
            '<b>$1</b>'
        );
        // 粗体 __text__
        html = html.replace(
            /__((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)__/g,
            '<b>$1</b>'
        );

        // 斜体 *text*（避免匹配粗体）
        html = html.replace(
            /(?<![*_])\*(?!\*)((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)\*(?!\*)/g,
            '<i>$1</i>'
        );
        // 斜体 _text_（避免匹配粗体）
        html = html.replace(
            /(?<![*_])_(?!_)((?:<span[^>]*>.*?<\/span>|\s|<[^>]+>)+)_(?!_)/g,
            '<i>$1</i>'
        );

        return html;
    }

    async countWords(text: string): Promise<[number, number, number]> {
        // 尝试使用缓存的 AST
        let ast = getCachedAST(text);
        if (!ast) {
            ast = this.processor.parse(text) as Root;
            cacheAST(text, ast);
        }

        let wordSet: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            let text = toString(word).toLowerCase();
            if (/[0-9\u4e00-\u9fa5]/.test(text)) return;
            wordSet.add(text);
        });
        let stored = await this.plugin.db.getStoredWords({
            article: "",
            words: [...wordSet],
        });
        let ignore = 0;
        stored.words.forEach((word) => {
            if (word.status === 0) ignore++;
        });
        let learn = stored.words.length - ignore;
        let unknown = wordSet.size - stored.words.length;
        return [unknown, learn, ignore];
    }

    async text2HTML(text: string) {
        this.pIdx = 0;
        this.words.clear();

        // 查找文本中的已知词组，用于构造ast中的PhraseNode
        this.phrases = (
            await this.plugin.db.getStoredWords({
                article: text.toLowerCase(),
                words: [],
            })
        ).phrases;

        // 尝试使用缓存的 AST
        let ast = getCachedAST(text);
        if (!ast) {
            ast = this.processor.parse(text) as Root;
            cacheAST(text, ast);
        }

        // 获得文章中去重后的单词
        let wordSet: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            wordSet.add(toString(word).toLowerCase());
        });

        // 查询这些单词的status
        let stored = await this.plugin.db.getStoredWords({
            article: "",
            words: [...wordSet],
        });

        stored.words.forEach((w) => this.words.set(w.text, w));

        let HTML = this.processor.stringify(ast) as any as string;
        return HTML;
    }

    async getWordsPhrases(text: string) {
        const ast = this.processor.parse(text);
        let words: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            words.add(toString(word).toLowerCase());
        });
        let wordsPhrases = await this.plugin.db.getStoredWords({
            article: text.toLowerCase(),
            words: [...words],
        });

        let payload = [] as string[];
        wordsPhrases.phrases.forEach((word) => {
            if (word.status > 0) payload.push(word.text);
        });
        wordsPhrases.words.forEach((word) => {
            if (word.status > 0) payload.push(word.text);
        });

        let res = await this.plugin.db.getExpressionsSimple(payload);
        return res;
    }

    // Plugin：在retextEnglish基础上，把AST上一些单词包裹成短语
    addPhrases() {
        let selfThis = this;
        return function (option = {}) {
            const proto = this.Parser.prototype;
            proto.useFirst("tokenizeParagraph", selfThis.phraseModifier);
        };
    }

    phraseModifier = modifyChildren(this.wrapWord2Phrase.bind(this));

    wrapWord2Phrase(node: Content, index: number, parent: Parent) {
        if (!node.hasOwnProperty("children")) return;

        if (
            this.pIdx >= this.phrases.length ||
            node.position.end.offset <= this.phrases[this.pIdx].offset
        )
            return;

        let children = (node as Sentence).children;

        let p: number;
        while (
            (p = children.findIndex(
                (child) =>
                    child.position.start.offset ===
                    this.phrases[this.pIdx].offset
            )) !== -1
        ) {
            let q = children.findIndex(
                (child) =>
                    child.position.end.offset ===
                    this.phrases[this.pIdx].offset +
                    this.phrases[this.pIdx].text.length
            );

            if (q === -1) {
                this.pIdx++;
                return;
            }
            let phrase = children.slice(p, q + 1);
            children.splice(p, q - p + 1, {
                type: "PhraseNode",
                children: phrase,
                position: {
                    start: { ...phrase.first().position.start },
                    end: { ...phrase.last().position.end },
                },
            } as any);

            this.pIdx++;

            if (
                this.pIdx >= this.phrases.length ||
                node.position.end.offset <= this.phrases[this.pIdx].offset
            )
                return;
        }
    }

    // Compiler部分: 在AST转换为string时包裹上相应标签
    stringfy2HTML() {
        let selfThis = this;
        return function () {
            Object.assign(this, {
                Compiler: selfThis.compileHTML.bind(selfThis),
            });
        };
    }

    compileHTML(tree: Root): string {
        return this.toHTMLString(tree);
    }

    toHTMLString(node: AnyNode): string {
        if (node.hasOwnProperty("value")) {
            return (node as Literal).value;
        }
        if (node.hasOwnProperty("children")) {
            let n = node as Parent;
            switch (n.type) {
                case "WordNode": {
                    let text = toString(n.children);
                    let textLower = text.toLowerCase();
                    let status = this.words.has(textLower)
                        ? STATUS_MAP[this.words.get(textLower).status]
                        : "new";

                    return /[0-9\u4e00-\u9fa5]/.test(text) // 不把数字当做单词
                        ? `<span class="other">${text}</span>`
                        : `<span class="word ${status}">${text}</span>`;
                }
                case "PhraseNode": {
                    let childText = toString(n.children);
                    let text = this.toHTMLString(n.children);
                    // 获取词组的status
                    let phrase = this.phrases.find(
                        (p) => p.text === childText.toLowerCase()
                    );
                    let status = STATUS_MAP[phrase.status];

                    return `<span class="phrase ${status}">${text}</span>`;
                }
                case "SentenceNode": {
                    return `<span class="stns">${this.toHTMLString(
                        n.children
                    )}</span>`;
                }
                case "ParagraphNode": {
                    return `<p>${this.toHTMLString(n.children)}</p>`;
                }
                default: {
                    return `<div class="article">${this.toHTMLString(
                        n.children
                    )}</div>`;
                }
            }
        }
        if (Array.isArray(node)) {
            let nodes = node as Content[];
            return nodes.map((n) => this.toHTMLString(n)).join("");
        }
    }
}
