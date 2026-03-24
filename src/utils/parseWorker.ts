/**
 * Parse Worker 管理类
 * 处理 Worker 创建、通信、错误处理和 fallback
 */

import { Phrase, Word } from "@/db/interface";

// Worker 代码（内联，避免需要额外的 worker 文件）
const WORKER_CODE = `(()=>{var x=["ignore","learning","familiar","known","learned"];function p(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function y(t){let s=[],a=/([a-zA-Z]+)|(\\s+)|([0-9\\u4e00-\\u9fa5]+)|(.)/g,e;for(;(e=a.exec(t))!==null;)e[1]?s.push({type:"word",text:e[1]}):e[2]?s.push({type:"whitespace",text:e[2]}):e[3]?s.push({type:"other",text:e[3]}):s.push({type:"punctuation",text:e[4]});return s}function f(t,s){if(t.type==="whitespace")return t.text;if(t.type==="other")return'<span class="other">'+p(t.text)+"</span>";if(t.type==="punctuation")return p(t.text);let a=t.text.toLowerCase();return'<span class="word "+(s.has(a)?x[s.get(a)]:"new")+">"+p(t.text)+"</span>"}function m(t,s,a){let e=y(t),i=[],n=0;for(;n<e.length;){let o=e[n],r=!1,l=Math.min(10,e.length-n);for(let c=l;c>1;c--){let u=e.slice(n,n+c),h=u.filter(g=>g.type==="word").map(g=>g.text.toLowerCase()).join(" ");if(a.has(h)){let g=u.map(d=>f(d,s)).join("");i.push('<span class="phrase learning">'+g+"</span>"),n+=c,r=!0;break}}r||(i.push(f(o,s)),n++)}return i.join("")}function w(t){let s=t.match(/^!\\[(.*?)\\]\\((.*?)\\)$/);if(!s)return"<p>"+p(t)+"</p>";let a=p(s[1]),e=p(s[2]);return'<div style="text-align:center"><div style="display:inline-block"><img alt="'+a+'" src="'+e+'"></div></div>'}function S(t,s,a){let e=new Map;for(let r of s)e.set(r.text.toLowerCase(),r.status);let i=new Set;for(let r of a)i.add(r.text.toLowerCase());let n=t.split(/\\n\\n+/),o=[];for(let r of n){if(!r.trim())continue;if(r.match(/^!\\[.*?\\]\\(.*?\\)$/)){o.push(w(r));continue}let l=r.match(/^(#{1,6})\\s+(.+)$/);if(l){let u=l[1].length,h=m(l[2],e,i);o.push("<h"+u+'><span class="stns">'+h+"</span></h"+u+">");continue}let c=m(r,e,i);o.push("<p>"+c+"</p>")}return o.join("")}self.onmessage=function(t){let{id:s,text:a,words:e,phrases:i}=t.data;try{let n=S(a,e,i),o={type:"PARSE_RESPONSE",id:s,html:n};self.postMessage(o)}catch(n){let o={type:"PARSE_RESPONSE",id:s,html:"",error:n instanceof Error?n.message:String(n)};self.postMessage(o)}};})();`;

// Worker 消息类型
interface ParseRequestMessage {
    type: "PARSE_REQUEST";
    id: number;
    text: string;
    words: Word[];
    phrases: Phrase[];
}

interface ParseResponseMessage {
    type: "PARSE_RESPONSE";
    id: number;
    html: string;
    error?: string;
}

// 待处理请求
interface PendingRequest {
    resolve: (html: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export class ParseWorkerManager {
    private worker: Worker | null = null;
    private requestId = 0;
    private pendingRequests = new Map<number, PendingRequest>();
    private fallbackMode = false;
    private workerUrl: string | null = null;

    /**
     * 初始化 Worker
     */
    private async initWorker(): Promise<boolean> {
        if (this.worker) return true;
        if (this.fallbackMode) return false;

        try {
            // 使用内联的 Worker 代码
            const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
            this.workerUrl = URL.createObjectURL(blob);
            this.worker = new Worker(this.workerUrl);

            this.worker.onmessage = this.handleMessage.bind(this);
            this.worker.onerror = this.handleError.bind(this);

            return true;
        } catch (err) {
            console.warn("[ParseWorker] Failed to create Web Worker:", err);
            this.fallbackMode = true;
            return false;
        }
    }

    /**
     * 处理 Worker 消息
     */
    private handleMessage(e: MessageEvent<ParseResponseMessage>) {
        const { id, html, error } = e.data;
        const request = this.pendingRequests.get(id);
        if (!request) return;

        this.pendingRequests.delete(id);
        clearTimeout(request.timer);

        if (error) {
            request.reject(new Error(error));
        } else {
            request.resolve(html);
        }
    }

    /**
     * 处理 Worker 错误
     */
    private handleError(err: ErrorEvent) {
        console.error("[ParseWorker] Worker error:", err);

        // 所有待处理请求都 reject
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timer);
            request.reject(new Error("Worker error: " + err.message));
        }
        this.pendingRequests.clear();

        // 切换到 fallback 模式
        this.terminate();
        this.fallbackMode = true;
    }

    /**
     * 发送解析请求
     */
    async parse(text: string, words: Word[], phrases: Phrase[]): Promise<string> {
        // 短文本直接使用主线程解析（避免 Worker 开销）
        if (text.length < 1000) {
            return this.parseInMainThread(text, words, phrases);
        }

        // 尝试使用 Worker
        const workerReady = await this.initWorker();
        if (workerReady) {
            try {
                return await this.parseWithWorker(text, words, phrases);
            } catch (err) {
                console.warn("[ParseWorker] Worker parse failed, falling back:", err);
                // 切换到 fallback 模式
                this.fallbackMode = true;
            }
        }

        // 主线程解析 fallback
        return this.parseInMainThread(text, words, phrases);
    }

    /**
     * 使用 Worker 解析
     */
    private async parseWithWorker(
        text: string,
        words: Word[],
        phrases: Phrase[]
    ): Promise<string> {
        const id = ++this.requestId;

        return new Promise((resolve, reject) => {
            // 设置超时
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error("Worker parse timeout"));
            }, 10000); // 10秒超时

            this.pendingRequests.set(id, { resolve, reject, timer });

            // 发送请求到 Worker
            const message: ParseRequestMessage = {
                type: "PARSE_REQUEST",
                id,
                text,
                words,
                phrases
            };
            this.worker!.postMessage(message);
        });
    }

    /**
     * 主线程解析（fallback）
     * 简化版实现，只支持基本功能
     */
    private parseInMainThread(
        text: string,
        words: Word[],
        phrases: Phrase[]
    ): string {
        // 创建单词状态查找表
        const wordStatusMap = new Map<string, number>();
        for (const word of words) {
            wordStatusMap.set(word.text.toLowerCase(), word.status);
        }

        // 单词状态映射
        const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];

        // HTML 转义
        const escapeHtml = (str: string): string => {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        // 按段落分割
        const paragraphs = text.split(/\n\n+/);
        const result: string[] = [];

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;

            // 处理 Markdown 图片
            const imgMatch = paragraph.match(/^!\[(.*?)\]\((.*?)\)$/);
            if (imgMatch) {
                const alt = escapeHtml(imgMatch[1]);
                const src = escapeHtml(imgMatch[2]);
                result.push(`<div style="text-align:center"><div style="display:inline-block"><img alt="${alt}" src="${src}"></div></div>`);
                continue;
            }

            // 处理标题
            const headerMatch = paragraph.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                const content = headerMatch[2];
                // 简单分词处理
                const tokens = content.split(/(\s+)/);
                const wrapped = tokens.map(token => {
                    if (/^\s+$/.test(token)) return token;
                    const lower = token.toLowerCase();
                    if (wordStatusMap.has(lower)) {
                        const status = STATUS_MAP[wordStatusMap.get(lower)!];
                        return `<span class="word ${status}">${escapeHtml(token)}</span>`;
                    }
                    if (/[0-9\u4e00-\u9fa5]/.test(token)) {
                        return `<span class="other">${escapeHtml(token)}</span>`;
                    }
                    return `<span class="word new">${escapeHtml(token)}</span>`;
                });
                result.push(`<h${level}><span class="stns">${wrapped.join("")}</span></h${level}>`);
                continue;
            }

            // 普通段落
            const tokens = paragraph.split(/(\s+)/);
            const wrapped = tokens.map(token => {
                if (/^\s+$/.test(token)) return token;
                const lower = token.toLowerCase();
                if (wordStatusMap.has(lower)) {
                    const status = STATUS_MAP[wordStatusMap.get(lower)!];
                    return `<span class="word ${status}">${escapeHtml(token)}</span>`;
                }
                if (/[0-9\u4e00-\u9fa5]/.test(token)) {
                    return `<span class="other">${escapeHtml(token)}</span>`;
                }
                return `<span class="word new">${escapeHtml(token)}</span>`;
            });
            result.push(`<p>${wrapped.join("")}</p>`);
        }

        return result.join("");
    }

    /**
     * 销毁 Worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.workerUrl) {
            URL.revokeObjectURL(this.workerUrl);
            this.workerUrl = null;
        }
        // 清理待处理请求
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timer);
            request.reject(new Error("Worker terminated"));
        }
        this.pendingRequests.clear();
    }
}

// 单例实例
let workerManager: ParseWorkerManager | null = null;

/**
 * 获取 Worker 管理器实例
 */
export function getParseWorker(): ParseWorkerManager {
    if (!workerManager) {
        workerManager = new ParseWorkerManager();
    }
    return workerManager;
}

/**
 * 释放 Worker 资源
 */
export function disposeParseWorker() {
    if (workerManager) {
        workerManager.terminate();
        workerManager = null;
    }
}
