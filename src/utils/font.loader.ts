/**
 * 字体加载工具
 * 加载内置的思源宋体字体用于 PDF 导出
 */

const FONT_NAME = 'Source Han Serif CN';
const FONT_URL = './assets/fonts/SourceHanSerifCN-Regular.woff2';

/**
 * 加载字体文件并返回 base64 编码
 */
export async function loadFontAsBase64(): Promise<string | null> {
    try {
        const response = await fetch(FONT_URL);
        if (!response.ok) {
            console.warn('[FontLoader] Failed to load font:', response.status);
            return null;
        }
        const blob = await response.blob();
        return await blobToBase64(blob);
    } catch (error) {
        console.error('[FontLoader] Error loading font:', error);
        return null;
    }
}

/**
 * 将 Blob 转换为 base64
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * 检查字体是否已加载
 */
export function isFontLoaded(): boolean {
    return document.fonts.check(`12px "${FONT_NAME}"`);
}

/**
 * 预加载字体
 */
export async function preloadFont(): Promise<void> {
    if (isFontLoaded()) return;

    try {
        const fontFace = new FontFace(
            FONT_NAME,
            `url(${FONT_URL})`,
            { weight: 'normal', style: 'normal' }
        );
        await fontFace.load();
        document.fonts.add(fontFace);
    } catch (error) {
        console.warn('[FontLoader] Failed to preload font:', error);
    }
}

/**
 * 获取字体 CSS 样式
 */
export function getFontFamily(): string {
    return `${FONT_NAME}, "Noto Serif CJK SC", "Source Han Serif SC", serif`;
}
