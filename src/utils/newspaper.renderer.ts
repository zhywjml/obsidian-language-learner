/**
 * 报纸渲染器
 * 将文章内容渲染为报纸风格的 HTML
 */

import { loadFontAsBase64, getFontFamily } from './font.loader';

export interface WordEntry {
    expression: string;
    phonetic?: string;
    meaning: string;
}

export interface NewspaperSettings {
    title: string;
    subtitle?: string;
    date: string;
    showPhonetic: boolean;
}

export class NewspaperRenderer {
    private container: HTMLElement | null = null;

    /**
     * 创建隐藏的渲染容器
     */
    private createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.id = 'newspaper-render-container';
        container.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            background: #f8f5f0;
            font-family: ${getFontFamily()};
            font-size: 12pt;
            line-height: 1.8;
            color: #1a1a1a;
            overflow: hidden;
            box-sizing: border-box;
        `;
        document.body.appendChild(container);
        this.container = container;
        return container;
    }

    /**
     * 生成报纸 HTML
     */
    async render(
        articleContent: string,
        words: WordEntry[],
        settings: NewspaperSettings
    ): Promise<HTMLElement> {
        const container = this.createContainer();

        // 添加样式
        const style = document.createElement('style');
        style.textContent = this.getStyles();
        container.appendChild(style);

        // 生成内容
        const content = document.createElement('div');
        content.className = 'newspaper-content';
        content.innerHTML = `
            ${this.renderHeader(settings)}
            <div class="newspaper-columns">
                <div class="article-column">
                    ${articleContent}
                </div>
                <div class="word-column">
                    ${this.renderWordList(words, settings)}
                </div>
            </div>
        `;
        container.appendChild(content);

        // 等待字体加载
        await document.fonts.ready;

        // 等待图片加载
        await this.waitForImages(container);

        return container;
    }

    /**
     * 渲染报纸头部
     */
    private renderHeader(settings: NewspaperSettings): string {
        const dateStr = settings.date || new Date().toLocaleDateString('zh-CN');
        return `
            <div class="newspaper-header">
                <div class="header-border"></div>
                <h1 class="newspaper-title">${settings.title}</h1>
                ${settings.subtitle ? `<p class="newspaper-subtitle">${settings.subtitle}</p>` : ''}
                <p class="newspaper-date">${dateStr}</p>
                <div class="header-divider"></div>
            </div>
        `;
    }

    /**
     * 渲染单词列表
     */
    private renderWordList(words: WordEntry[], settings: NewspaperSettings): string {
        if (words.length === 0) {
            return '<div class="no-words">本页无标注单词</div>';
        }

        const wordItems = words.map(word => `
            <div class="word-item">
                <div class="word-header">
                    <span class="word-expression">${word.expression}</span>
                    ${settings.showPhonetic && word.phonetic ?
                        `<span class="word-phonetic">${word.phonetic}</span>` : ''}
                </div>
                <div class="word-meaning">${word.meaning}</div>
            </div>
        `).join('');

        return `
            <div class="word-list">
                <h3 class="word-list-title">词汇表</h3>
                ${wordItems}
            </div>
        `;
    }

    /**
     * 获取 CSS 样式
     */
    private getStyles(): string {
        return `
            .newspaper-content {
                padding: 15mm;
                box-sizing: border-box;
            }

            /* 头部样式 */
            .newspaper-header {
                text-align: center;
                margin-bottom: 20px;
                padding: 15px 0;
            }

            .header-border {
                border-top: 3px solid #5c4033;
                border-bottom: 1px solid #5c4033;
                height: 6px;
                margin-bottom: 15px;
            }

            .newspaper-title {
                font-size: 28pt;
                font-weight: bold;
                margin: 0 0 8px 0;
                letter-spacing: 2px;
                color: #1a1a1a;
            }

            .newspaper-subtitle {
                font-size: 14pt;
                color: #4a4a4a;
                margin: 0 0 5px 0;
            }

            .newspaper-date {
                font-size: 10pt;
                color: #8b7355;
                margin: 0;
            }

            .header-divider {
                border-bottom: 2px solid #8b7355;
                margin-top: 15px;
            }

            /* 分栏布局 */
            .newspaper-columns {
                display: flex;
                gap: 0;
                min-height: 220mm;
            }

            .article-column {
                width: 70%;
                padding-right: 15px;
                border-right: 1px solid #8b7355;
            }

            .word-column {
                width: 30%;
                padding-left: 15px;
            }

            /* 文章样式 */
            .article-column p {
                text-indent: 2em;
                margin: 0 0 1em 0;
                text-align: justify;
            }

            .article-column h1,
            .article-column h2,
            .article-column h3 {
                font-size: 14pt;
                margin: 1em 0 0.5em 0;
            }

            /* 单词栏样式 */
            .word-list-title {
                font-size: 12pt;
                font-weight: bold;
                border-bottom: 1px solid #8b7355;
                padding-bottom: 5px;
                margin: 0 0 10px 0;
            }

            .word-item {
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px dotted #d4c5b5;
            }

            .word-header {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-bottom: 3px;
            }

            .word-expression {
                font-weight: bold;
                font-size: 11pt;
            }

            .word-phonetic {
                font-family: "Times New Roman", serif;
                font-style: italic;
                font-size: 9pt;
                color: #666;
            }

            .word-meaning {
                font-size: 10pt;
                color: #4a4a4a;
                line-height: 1.5;
            }

            .no-words {
                text-align: center;
                color: #999;
                font-size: 10pt;
                padding: 20px 0;
            }

            /* 图片样式 */
            .article-column img {
                max-width: 100%;
                height: auto;
                display: block;
                margin: 1em auto;
            }
        `;
    }

    /**
     * 等待图片加载完成
     */
    private async waitForImages(container: HTMLElement): Promise<void> {
        const images = container.querySelectorAll('img');
        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 5000); // 超时 5 秒
            });
        });
        await Promise.all(promises);
    }

    /**
     * 清理容器
     */
    cleanup(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
    }
}
