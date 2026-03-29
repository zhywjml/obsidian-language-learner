<template>
    <div id="langr-reading" ref="reading" style="height: 100%">
        <div class="reading-container"
            style="height: 100%; display: flex; flex-direction: column">
            <!-- 功能区 -->
            <div class="function-area">
                <audio controls v-if="audioSource" :src="audioSource" />
                <div style="display: flex">
                    <button @click="activeNotes = true">做笔记</button>
                    <div style="
                            flex: 1;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        ">
                        <CountBar v-if="plugin.settings.word_count" :unknown="unknown" :learn="learn"
                            :ignore="ignore" />
                    </div>
                    <!-- 样式设置按钮 -->
                    <button class="style-settings-btn" @click="showStyleSettings = !showStyleSettings" title="阅读样式设置">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                        </svg>
                    </button>
                    <button v-if="page * pageSize < totalLines" class="finish-reading" @click="addIgnores">
                        结束阅读并转入下一页
                    </button>
                    <button v-else class="finish-reading" @click="addIgnores">
                        结束阅读
                    </button>
                </div>
            </div>
            <!-- 样式设置面板 -->
            <div class="style-settings-panel" v-if="showStyleSettings">
                <div class="style-item">
                    <label>字号</label>
                    <input type="range" v-model="fontSizeNum" min="12" max="28" step="1" />
                    <span class="style-value">{{ fontSizeNum }}px</span>
                </div>
                <div class="style-item">
                    <label>行距</label>
                    <input type="range" v-model="lineHeightNum" min="1" max="3" step="0.1" />
                    <span class="style-value">{{ lineHeightNum }}</span>
                </div>
                <div class="style-item">
                    <label>字距</label>
                    <input type="range" v-model="wordSpacingNum" min="-0.1" max="0.5" step="0.05" />
                    <span class="style-value">{{ wordSpacingNum }}em</span>
                </div>
            </div>
            <!-- 阅读区 -->
            <div
                class="text-area"
                ref="readingContentRef"
                style="
                    flex: 1;
                    overflow: auto;
                    padding-left: 5%;
                    padding-right: 5%;
                " :style="{
                    fontSize: store.fontSize,
                    fontFamily: store.fontFamily,
                    lineHeight: store.lineHeight,
                    wordSpacing: store.wordSpacing,
                }" v-html="renderedText" />
            <!-- 底栏 -->
            <div class="pagination" style="
                    padding: 10px 0;
                    border-top: 2px solid gray;
                    display: flex;
                    flex-direction: column;
                ">
                <DockPagination
                    v-model:page="page"
                    v-model:pageSize="pageSize"
                    :total="totalLines"
                />
            </div>
            <!-- 笔记抽屉 -->
            <div class="drawer" v-if="activeNotes" @click.self="activeNotes = false">
                <div class="drawer-content">
                    <div class="drawer-header">
                        <span class="drawer-title">Notes</span>
                        <button class="drawer-close" @click="activeNotes = false">×</button>
                    </div>
                    <div class="drawer-body">
                        <div class="note-area">
                            <textarea class="note-input" v-model="notes" :placeholder="t('Write notes...')"></textarea>
                            <div class="note-rendered" @mouseover="onMouseOver" ref="renderedNote"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    ref,
    Ref,
    getCurrentInstance,
    computed,
    watch,
    onMounted,
    onUnmounted,
    watchEffect,
} from "vue";
import { MarkdownRenderer, Platform } from "obsidian";
import PluginType from "@/plugin";
import { t } from "@/lang/helper";
import { useEvent } from "@/utils/use";
import { debounce, runWhenIdle } from "@/utils/helpers";
import store from "@/store";
import { ReadingView } from "./ReadingView";
import CountBar from "./CountBar.vue";
import DockPagination from "./DockPagination.vue";
import { clearParseCache, clearASTCache } from "./parser";

let vueThis = getCurrentInstance();
let view = vueThis.appContext.config.globalProperties.view as ReadingView;
let plugin = view.plugin as PluginType;
let contentEl = view.contentEl as HTMLElement;

// 获取本地文件路径前缀（仅桌面端）
let localPrefix = "";
if (Platform.isDesktopApp) {
    localPrefix = require("electron").ipcRenderer.sendSync("file-url");
}
// app.vault.adapter.getResourcePath("");
let frontMatter = plugin.app.metadataCache.getFileCache(view.file).frontmatter;
let audioSource = (frontMatter["langr-audio"] || "") as string;
if (audioSource && audioSource.startsWith("~/")) {
    const prefix = Platform.isDesktopApp ? localPrefix : "http://localhost/_capacitor_file_";
    audioSource =
        prefix + plugin.constants.basePath + audioSource.slice(1);
}else {
    audioSource = audioSource.startsWith("http") ? audioSource : (Platform.isDesktopApp ? localPrefix : "");
}

// 记笔记
let activeNotes = ref(false);
let notes = ref("");
async function afterNoteEnter() {
    notes.value = await view.readContent("notes", true);
}
async function afterNoteLeave() {
    view.writeContent("notes", notes.value);
}

let renderedNote = ref<HTMLElement>();
watchEffect(async (clean) => {
    if (!renderedNote.value) return;
    await MarkdownRenderer.renderMarkdown(
        notes.value,
        renderedNote.value,
        view.file.path,
        null
    );
    clean(() => {
        renderedNote.value?.empty();
    });
});

function onMouseOver(e: MouseEvent) {
    let target = e.target as HTMLElement;
    if (target.hasClass("internal-link")) {
        app.workspace.trigger("hover-link", {
            event: e,
            source: "preview",
            hoverParent: { hoverPopover: null },
            targetEl: target,
            linktext: target.getAttr("href"),
            soursePath: view.file.path,
        });
    }
}

// 拆分文本
let lines = view.text.split("\n");
let segments = view.divide(lines);
if (!segments["article"]) {
    segments["article"] = { start: 0, end: lines.length };
}

let article = lines.slice(segments["article"].start, segments["article"].end);
let totalLines = article.length;

// 计数
let unknown = ref(0);
let learn = ref(0);
let ignore = ref(0);
let countChange = ref(true);
let refreshCount = () => {
    countChange.value = !countChange.value;
};

if (plugin.settings.word_count) {
    watch(
        [countChange],
        async () => {
            // 使用 runWhenIdle 延迟非关键统计，优先保证阅读流畅度
            runWhenIdle(async () => {
                [unknown.value, learn.value, ignore.value] =
                    await plugin.parser.countWords(article.join("\n"));
            }, 1000); // 1秒超时
        },
        { immediate: true }
    );

    onMounted(() => {
        addEventListener("obsidian-langr-refresh", refreshCount);
    });
    onUnmounted(() => {
        removeEventListener("obsidian-langr-refresh", refreshCount);
    });
}

// 分页渲染文本

let dp = plugin.settings.default_paragraphs;
let pageSize = dp === "all" ? ref(Number.MAX_VALUE) : ref(parseInt(dp));
let page = view.lastPos
    ? ref(Math.ceil(view.lastPos / pageSize.value))
    : ref(1);

// 样式设置面板
let showStyleSettings = ref(false);

// 从设置初始化样式值
let fontSizeNum = ref(parseInt(plugin.settings.font_size) || 15);
let lineHeightNum = ref(parseFloat(plugin.settings.line_height) || 1.8);
let wordSpacingNum = ref(parseFloat(plugin.settings.word_spacing) || 0);

// 创建防抖的样式更新函数
const updateStyles = debounce((fs: number, lh: number, ws: number) => {
    store.fontSize = `${fs}px`;
    store.lineHeight = `${lh}`;
    store.wordSpacing = `${ws}em`;
}, 100); // 100ms 防抖延迟

// 监听样式变化
watch([fontSizeNum, lineHeightNum, wordSpacingNum], ([fs, lh, ws]) => {
    updateStyles(fs, lh, ws);
}, { immediate: true });

let renderedText = ref("");
let refreshHandle = ref(true);

// pageSize变化应该使page同时进行调整以尽量保持原阅读位置
watch([pageSize], async ([ps], [prev_ps]) => {
    let oldPage = page.value;
    page.value = Math.ceil(((page.value - 1) * prev_ps + 1) / ps);
    // 如果页码没变，手动触发刷新
    if (oldPage === page.value) {
        refreshHandle.value = !refreshHandle.value;
    }
});

watch(
    [page, refreshHandle],
    async () => {
        let start = (page.value - 1) * pageSize.value;
        let end =
            start + pageSize.value > totalLines
                ? totalLines
                : start + pageSize.value;

        renderedText.value = await plugin.parser.parse(
            article.slice(start, end).join("\n")
        );

        plugin.frontManager.setFrontMatter(
            view.file,
            "langr-pos",
            `${(page.value - 1) * pageSize.value + 1}`
        );
    },
    { immediate: true }
);

// 设置阅读文字样式

// 添加无视单词
async function addIgnores() {
    let ignores = contentEl.querySelectorAll(
        ".word.new"
    ) as unknown as HTMLElement[];
    let ignore_words: Set<string> = new Set();
    ignores.forEach((el) => {
        ignore_words.add(el.textContent.toLowerCase());
    });

    if (ignore_words.size > 0) {
        await plugin.db.postIgnoreWords([...ignore_words]);
    }

    // 立即更新当前页DOM中这些单词的样式（从 new 变为 ignore）
    ignores.forEach((el) => {
        el.classList.remove("new");
        el.classList.add("ignore");
    });

    // 触发统计刷新
    dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

    // 刷新计数
    refreshCount();

    // 清除解析缓存，确保下一页或刷新时获取最新状态
    clearParseCache();
    clearASTCache();

    if (page.value * pageSize.value < totalLines) {
        // 进入下一页，触发 watch 重新解析
        page.value++;
    } else {
        // 最后一页，手动刷新当前页面
        refreshHandle.value = !refreshHandle.value;
    }
}

let reading = ref(null);

// 选择状态管理
interface SelectionState {
    isActive: boolean;
    isMultiSelect: boolean;
    startEl: HTMLElement | null;
    currentEl: HTMLElement | null;
    startX: number;
    startY: number;
    startTime: number;
    longPressTimer: ReturnType<typeof setTimeout> | null;
}

let selectState: SelectionState = {
    isActive: false,
    isMultiSelect: false,
    startEl: null,
    currentEl: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    longPressTimer: null
};

// 节流函数 - 用于 pointermove
function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let lastTime = 0;
    return function (...args: Parameters<T>) {
        const now = Date.now();
        if (now - lastTime >= delay) {
            lastTime = now;
            fn(...args);
        }
    };
}

// 判断是否可选择的元素
function isSelectableElement(el: HTMLElement): boolean {
    return el.hasClass("word") || el.hasClass("phrase") || el.hasClass("select");
}

// 清理选择状态
function clearSelectionState() {
    if (selectState.longPressTimer) {
        clearTimeout(selectState.longPressTimer);
        selectState.longPressTimer = null;
    }
    view.clearPreview();
    selectState = {
        isActive: false,
        isMultiSelect: false,
        startEl: null,
        currentEl: null,
        startX: 0,
        startY: 0,
        startTime: 0,
        longPressTimer: null
    };
}

// pointerdown 事件处理
useEvent(reading, "pointerdown", (e: PointerEvent) => {
    const target = e.target as HTMLElement;

    if (!isSelectableElement(target)) {
        // 点击非单词区域，清除现有选择
        view.removeSelect();
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    // 捕获指针，确保后续事件都在此元素上触发
    (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);

    // 初始化选择状态
    selectState.isActive = true;
    selectState.startEl = target;
    selectState.currentEl = target;
    selectState.startX = e.clientX;
    selectState.startY = e.clientY;
    selectState.startTime = Date.now();

    // 设置长按定时器 - 200ms后进入多选模式
    selectState.longPressTimer = setTimeout(() => {
        if (selectState.isActive && !selectState.isMultiSelect) {
            selectState.isMultiSelect = true;
            // 开始预览高亮
            view.previewSelect(selectState.startEl, selectState.startEl);
        }
    }, 200);
});

// pointermove 事件处理（节流16ms ≈ 60fps）
const handlePointerMove = throttle((e: PointerEvent) => {
    if (!selectState.isActive || !selectState.startEl) return;

    const moveDistance = Math.sqrt(
        Math.pow(e.clientX - selectState.startX, 2) +
        Math.pow(e.clientY - selectState.startY, 2)
    );

    // 如果移动距离超过10px，提前进入多选模式
    if (!selectState.isMultiSelect && moveDistance > 10) {
        selectState.isMultiSelect = true;
        if (selectState.longPressTimer) {
            clearTimeout(selectState.longPressTimer);
            selectState.longPressTimer = null;
        }
    }

    // 在多选模式下，更新选择范围
    if (selectState.isMultiSelect) {
        e.preventDefault();
        e.stopPropagation();

        // 使用 elementFromPoint 获取当前指针下的元素
        const elementUnderPointer = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;

        if (elementUnderPointer && isSelectableElement(elementUnderPointer)) {
            // 检查是否在同一句话中
            const startParent = selectState.startEl.matchParent(".stns");
            const currentParent = elementUnderPointer.matchParent(".stns");

            if (startParent && currentParent && startParent === currentParent) {
                selectState.currentEl = elementUnderPointer;
                view.previewSelect(selectState.startEl, selectState.currentEl);
            }
        }
    }
}, 16);

useEvent(reading, "pointermove", handlePointerMove);

// pointerup 事件处理
useEvent(reading, "pointerup", (e: PointerEvent) => {
    if (!selectState.isActive) return;

    e.preventDefault();
    e.stopPropagation();

    const duration = Date.now() - selectState.startTime;
    const wasMultiSelect = selectState.isMultiSelect;

    if (!wasMultiSelect) {
        // 快速点击模式（非多选）
        if (selectState.longPressTimer) {
            clearTimeout(selectState.longPressTimer);
            selectState.longPressTimer = null;
        }

        // 点击查询单个单词
        if (selectState.startEl) {
            const text = selectState.startEl.textContent;
            view.removeSelect();
            plugin.queryWord(
                text,
                selectState.startEl,
                { x: e.pageX, y: e.pageY }
            );
        }
    } else {
        // 多选模式结束 - 确认选择
        const finalTarget = e.target as HTMLElement;

        // 优先使用最后有效的 currentEl，否则使用当前指针下的元素
        let endEl = selectState.currentEl;
        if (!endEl || !isSelectableElement(endEl)) {
            if (isSelectableElement(finalTarget)) {
                endEl = finalTarget;
            } else {
                // 如果没有有效的结束元素，使用起始元素
                endEl = selectState.startEl;
            }
        }

        // 清理预览高亮
        view.clearPreview();

        // 执行正式选择包装
        const selectSpan = view.wrapSelect(selectState.startEl, endEl);
        if (selectSpan) {
            plugin.queryWord(
                selectSpan.textContent,
                selectSpan,
                { x: e.pageX, y: e.pageY }
            );
        }
    }

    clearSelectionState();
});

// pointercancel 事件处理（触摸中断等情况）
useEvent(reading, "pointercancel", () => {
    clearSelectionState();
});

// pointerleave 事件处理
useEvent(reading, "pointerleave", () => {
    if (selectState.isActive && !selectState.isMultiSelect) {
        clearSelectionState();
    }
});

</script>

<style lang="scss">
#langr-reading {
    user-select: none;

    .function-area {
        padding-bottom: 10px;
        border-bottom: 2px solid gray;

        button {
            width: auto;
        }
    }

    .text-area {
        touch-action: none;

        span.word {
            user-select: contain;
            border: 1px solid transparent;
            cursor: pointer;
            border-radius: 4px;

            &:hover {
                border-color: deepskyblue;
            }
        }

        span.phrase {
            background-color: transparent;
            padding-top: 3px;
            padding-bottom: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: 4px;

            &:hover {
                border-color: deepskyblue;
            }
        }

        span.stns {
            border: 1px solid transparent;
        }

        span {
            .new {
                background-color: #add8e644;
            }

            .learning {
                background-color: #ff980055;
            }

            .familiar {
                background-color: #ffeb3c55;
            }

            .known {
                background-color: #9eda5855;
            }

            .learned {
                background-color: #4cb05155;
            }
        }

        span.other {
            user-select: text;
        }

        .select {
            background-color: #90ee9060;
            padding-top: 3px;
            padding-bottom: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: 4px;

            &:hover {
                border: 1px solid green;
            }
        }

        // 临时选择预览状态
        span.selecting {
            background-color: rgba(144, 238, 144, 0.25);
            border: 1px dashed #4caf50;
            border-radius: 4px;
            transition: background-color 0.1s ease;
        }

        // 选择起始点标识
        span.selecting-start {
            border: 2px solid #4caf50;
            border-radius: 4px;
        }

        // Markdown 渲染元素样式
        h1, h2, h3, h4, h5, h6 {
            color: var(--text-normal);
            font-weight: 700;
            margin: 0.5em 0;
            user-select: text;
        }

        h1 { font-size: 1.8em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.3em; }
        h4 { font-size: 1.1em; }
        h5 { font-size: 1em; }
        h6 { font-size: 0.9em; }

        strong {
            font-weight: 700;
            user-select: text;
        }

        em {
            font-style: italic;
            user-select: text;
        }

        del {
            text-decoration: line-through;
            user-select: text;
        }

        // 图片样式
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1em auto;
        }

        // 图片容器样式
        div:has(> img) {
            text-align: center;
        }
    }

    .note-area {
        display: flex;
        height: 100%;
        width: 100%;
        gap: 8px;

        .note-input {
            flex: 1;
            resize: none;
            padding: 8px;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            font-family: inherit;
            font-size: 13px;
            line-height: 1.5;

            &:focus {
                outline: none;
                border-color: var(--interactive-accent);
            }
        }

        .note-rendered {
            flex: 1;
            padding: 8px;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            overflow: auto;
            color: var(--text-normal);
        }
    }
}

// 抽屉样式
.drawer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 250px;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
    z-index: 100;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);

    .drawer-content {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .drawer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .drawer-title {
        font-weight: 700;
        font-size: 14px;
        color: var(--text-normal);
    }

    .drawer-close {
        width: 24px;
        height: 24px;
        padding: 0;
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
            color: var(--text-normal);
        }
    }

    .drawer-body {
        flex: 1;
        padding: 12px;
        overflow: auto;
    }
}

.is-mobile #langr-reading {
    .pagination {
        padding-bottom: 48px;
    }
}

// 样式设置面板
.style-settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    margin-right: 8px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.15s ease;

    &:hover {
        background: var(--background-secondary-alt);
        color: var(--text-normal);
    }
}

.style-settings-panel {
    display: flex;
    justify-content: center;
    gap: 24px;
    padding: 12px 16px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);

    .style-item {
        display: flex;
        align-items: center;
        gap: 8px;

        label {
            font-size: 12px;
            color: var(--text-muted);
            min-width: 32px;
        }

        input[type="range"] {
            width: 100px;
            height: 4px;
            background: var(--background-modifier-border);
            border-radius: 2px;
            cursor: pointer;
            -webkit-appearance: none;

            &::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                background: var(--interactive-accent);
                border-radius: 50%;
                cursor: pointer;
            }

            &::-moz-range-thumb {
                width: 14px;
                height: 14px;
                background: var(--interactive-accent);
                border-radius: 50%;
                cursor: pointer;
                border: none;
            }
        }

        .style-value {
            font-size: 11px;
            color: var(--text-muted);
            min-width: 48px;
            text-align: right;
        }
    }
}
</style>
