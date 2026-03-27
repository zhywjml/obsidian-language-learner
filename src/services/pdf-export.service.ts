/**
 * PDF 导出服务
 * 协调报纸渲染、截图和 PDF 生成
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { NewspaperRenderer, WordEntry, NewspaperSettings } from '../utils/newspaper.renderer';
import { preloadFont } from '../utils/font.loader';

export type { WordEntry, NewspaperSettings };

export interface PdfExportOptions {
    /** 文章 HTML 内容 */
    articleContent: string;
    /** 单词列表 */
    words: WordEntry[];
    /** 报纸设置 */
    settings: NewspaperSettings;
    /** 文件名 */
    filename?: string;
    /** 分页高度 (mm) */
    pageHeight?: number;
}

export class PdfExportService {
    private renderer: NewspaperRenderer;

    constructor() {
        this.renderer = new NewspaperRenderer();
    }

    /**
     * 导出为 PDF
     */
    async exportToPDF(options: PdfExportOptions): Promise<Blob> {
        const {
            articleContent,
            words,
            settings,
            pageHeight = 297 // A4 高度 mm
        } = options;

        try {
            // 预加载字体
            await preloadFont();

            // 1. 渲染报纸 HTML
            const container = await this.renderer.render(articleContent, words, settings);

            // 2. 使用 html2canvas 截图
            const canvas = await this.captureToCanvas(container);

            // 3. 分割页面
            const pages = this.splitToPages(canvas, pageHeight);

            // 4. 生成 PDF
            const pdfBlob = await this.generatePDF(pages);

            return pdfBlob;
        } finally {
            // 清理渲染容器
            this.renderer.cleanup();
        }
    }

    /**
     * 使用 html2canvas 截图
     */
    private async captureToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
        const canvas = await html2canvas(element, {
            scale: 2, // 高清截图
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#f8f5f0',
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
        });
        return canvas;
    }

    /**
     * 按页面高度分割 canvas
     */
    private splitToPages(
        canvas: HTMLCanvasElement,
        pageHeightMm: number
    ): HTMLCanvasElement[] {
        const pages: HTMLCanvasElement[] = [];

        // A4 尺寸：210mm x 297mm
        // 转换为像素（假设 96 DPI）
        const mmToPx = 96 / 25.4;
        const pageHeightPx = pageHeightMm * mmToPx;
        const pageWidthPx = 210 * mmToPx;

        const totalHeight = canvas.height;
        const scale = canvas.width / pageWidthPx;
        const scaledPageHeight = pageHeightPx * scale;

        let currentY = 0;

        while (currentY < totalHeight) {
            const remainingHeight = Math.min(scaledPageHeight, totalHeight - currentY);

            // 创建新 canvas
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = remainingHeight;

            const ctx = pageCanvas.getContext('2d');
            if (!ctx) continue;

            // 复制对应区域
            ctx.drawImage(
                canvas,
                0, currentY, canvas.width, remainingHeight,
                0, 0, canvas.width, remainingHeight
            );

            pages.push(pageCanvas);
            currentY += scaledPageHeight;
        }

        return pages;
    }

    /**
     * 生成 PDF
     */
    private async generatePDF(pages: HTMLCanvasElement[]): Promise<Blob> {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) {
                pdf.addPage();
            }

            const canvas = pages[i];
            const imgData = canvas.toDataURL('image/jpeg', 0.95);

            // A4 尺寸
            const pageWidth = 210;
            const pageHeight = 297;

            // 计算图片尺寸以适应页面
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * pageWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        }

        return pdf.output('blob');
    }

    /**
     * 触发下载
     */
    downloadPDF(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * 扫描文章获取单词
     */
    scanArticleWords(contentElement: HTMLElement): WordEntry[] {
        const words: WordEntry[] = [];
        const seen = new Set<string>();

        // 查找所有高亮单词元素
        const wordElements = contentElement.querySelectorAll('.word-btn, [data-word]');

        wordElements.forEach(el => {
            const word = el.getAttribute('data-word') || el.textContent?.trim();
            if (word && !seen.has(word.toLowerCase())) {
                seen.add(word.toLowerCase());
                words.push({
                    expression: word,
                    meaning: '', // 需要从数据库获取
                });
            }
        });

        return words;
    }
}

// 单例导出
export const pdfExportService = new PdfExportService();
