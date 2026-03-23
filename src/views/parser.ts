import { unified, Processor } from "unified";
import retextEnglish from "retext-english";
import { Root, Content, Literal, Parent, Sentence } from "nlcst";
import { modifyChildren } from "unist-util-modify-children";
import { visit } from "unist-util-visit";
import { toString } from "nlcst-to-string";

import { Phrase, Word } from "@/db/interface";
import Plugin from "@/plugin";

// 单词状态映射：索引 -> CSS类名
const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];
type AnyNode = Root | Content | Content[];

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
     * @param data 文本内容
     */
    async parse(data: string) {
        // 先处理 Markdown 语法（在原始文本上处理）
        let processedData = this.preprocessMarkdown(data.trim());
        let newHTML = await this.text2HTML(processedData);
        let html = this.processContent(newHTML);
        return html;
    }

    /**
     * 预处理 Markdown 语法（在原始文本上处理）
     * 处理 Obsidian wikilink 链接格式
     */
    private preprocessMarkdown(text: string): string {
        // 处理 Obsidian wikilink 格式（非图片）: [[link]] 或 [[link|text]]
        text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, text) => {
            return text || link;
        });

        return text;
    }

    /**
     * 处理 Markdown 语法
     * 支持：多级标题、粗体、斜体、删除线
     */
    processContent(htmlContent: string): string {
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

    async countWords(text: string): Promise<[number, number, number]> {
        const ast = this.processor.parse(text);
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

        const ast = this.processor.parse(text);

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
