/**
 * 播放音频
 */
export function playAudio(src: string) {
    new Audio(src).play();
}

/**
 * 计算字符串的简单哈希值
 * 用于缓存键生成
 */
export function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
}

/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (...args: Parameters<T>) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn(...args);
        }, delay);
    };
}