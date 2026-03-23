import zh from "./locale/zh";
import en from "./locale/en";
import zh_TW from "./locale/zh-TW";

type LocaleType = { [key: string]: string };

const localeMap: Record<string, LocaleType> = {
    en: en as unknown as LocaleType,
    zh: zh as unknown as LocaleType,
    "zh-TW": zh_TW as unknown as LocaleType,
};

// 当前语言，默认中文
let currentLang: string = "zh";

/**
 * 设置当前语言
 */
export function setLanguage(lang: "zh" | "en" | "zh-TW"): void {
    currentLang = lang;
}

/**
 * 获取当前语言
 */
export function getLanguage(): string {
    return currentLang;
}

/**
 * 翻译函数
 */
export function t(text: string): string {
    const locale = localeMap[currentLang];
    return (locale && locale[text]) || (en as unknown as LocaleType)[text];
}