import { reactive } from "vue";

/**
 * Vue 响应式状态存储
 *
 * 用于在组件间共享状态：
 * - dark: 是否为深色主题
 * - themeChange: 主题变化标记（触发组件更新）
 * - fontSize/fontFamily/lineHeight/wordSpacing: 阅读模式样式
 * - popupSearch: 是否启用弹窗查词
 * - searchPinned: 查词面板是否固定
 * - dictsChange: 词典配置变化标记
 * - dictHeight: 词典面板高度
 */
const store = reactive({
    text: "",
    dark: false,
    themeChange: false,
    fontSize: "",
    fontFamily: "",
    lineHeight: "",
    wordSpacing: "",
    popupSearch: true,
    searchPinned: false,
    dictsChange: false,
    dictHeight: "",
});

export default store;