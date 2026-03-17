import zh from "./locale/zh";
import en from "./locale/en";
import zh_TW from "./locale/zh-TW";

type LocaleType = { [key: string]: string };

const localeMap: Record<string, LocaleType> = {
    en: en as unknown as LocaleType,
    zh: zh as unknown as LocaleType,
    "zh-TW": zh_TW as unknown as LocaleType,
};


const lang = window.localStorage.getItem("language");
const locale: LocaleType = localeMap[lang || "en"];

export function t(text: string): string {
    return (locale && locale[text]) || (en as unknown as LocaleType)[text];
}