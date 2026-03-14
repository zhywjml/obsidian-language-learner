/**
 * 词典注册模块
 *
 * 注册所有可用的词典引擎：
 * - Youdao: 有道词典，英中互译
 * - Cambridge: 剑桥词典，英译中
 * - Jukuu: 句酷，英中互译
 * - HJdict: 沪江词典，多语言支持
 * - DeepL: DeepL 翻译
 */

import { t } from "@/lang/helper";
import Youdao from "./youdao/View.vue";
import Cambridge from "./cambridge/View.vue";
import Jukuu from "./jukuu/View.vue";
import HJdict from "./hjdict/View.vue";
import DeepL from "./deepl/View.vue";

// 词典配置：名称、描述、Vue 组件
const dicts = {
    "youdao": {
        name: t("Youdao"),
        description: `${t("English")} <=> ${t("Chinese")}`,
        Cp: Youdao
    },
    "cambridge": {
        name: t("Cambridge"),
        description: `${t("English")} => ${t("Chinese")}`,
        Cp: Cambridge
    },
    "jukuu": {
        name: t("Jukuu"),
        description: `${t("English")} <=> ${t("Chinese")}`,
        Cp: Jukuu
    },
    "hjdict": {
        name: t("Hujiang"),
        description: `${t("English")},${t("Japanese")}, ${t("Korean")}, ${t("Spanish")}, ${t("French")}, ${t("Deutsch")} <=> ${t("Chinese")}`,
        Cp: HJdict
    },
    "deepl": {
        name: "DeepL",
        description: `All <=> ${t("Chinese")}`,
        Cp: DeepL
    }
};

export { dicts };