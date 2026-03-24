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

/**
 * 使用 requestIdleCallback 或 setTimeout 延迟执行
 * 用于非关键任务的延迟处理
 * @param callback 要执行的函数
 * @param timeout 超时时间（毫秒）
 */
export function runWhenIdle(callback: () => void, timeout?: number): void {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout });
    } else {
        setTimeout(callback, timeout || 1);
    }
}