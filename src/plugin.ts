/**
 * Language Learner - Obsidian 语言学习插件
 *
 * 主要功能：
 * - 划词查词（支持有道、剑桥、DeepL等多个词典）
 * - 生词管理（学习状态：Ignore/Learning/Familiar/Known/Learned）
 * - 阅读模式（将每个单词变成可点击按钮）
 * - 统计图表
 */

import {
    Notice,
    Plugin,
    Menu,
    WorkspaceLeaf,
    ViewState,
    MarkdownView,
    Editor,
    TFile,
    normalizePath,
    Platform,
} from "obsidian";
import { around } from "monkey-around";
import { createApp, App as VueApp } from "vue";

import { SearchPanelView, SEARCH_ICON, SEARCH_PANEL_VIEW } from "./views/SearchPanelView";
import { READING_VIEW_TYPE, READING_ICON, ReadingView } from "./views/ReadingView";
import { LearnPanelView, LEARN_ICON, LEARN_PANEL_VIEW } from "./views/LearnPanelView";
import { StatView, STAT_ICON, STAT_VIEW_TYPE } from "./views/StatView";
import { DataPanelView, DATA_ICON, DATA_PANEL_VIEW } from "./views/DataPanelView";
import { AnkiExportView, ANKI_EXPORT_ICON, ANKI_EXPORT_VIEW } from "./views/AnkiExportView";
import { MdictPanelView, MDICT_ICON, MDICT_PANEL_VIEW } from "./dictionary/mdict/MdictPanelView";
import { ReviewPanelView, REVIEW_PANEL_VIEW, REVIEW_ICON } from "./views/ReviewPanelView";
// import { PDFView, PDF_FILE_EXTENSION, VIEW_TYPE_PDF } from "./views/PDFView";

import { t, setLanguage } from "./lang/helper";
import DbProvider from "./db/base";
import { WebDb } from "./db/web_db";
import { LocalDb } from "./db/local_db";
import { JsonSyncDb } from "./db/json_sync_db";
import { DataMigration } from "./db/migration";
import { validateJsonFormat, mergeExpressions, mergeSentences, createJsonDataFormat } from "./db/json_serializer";
import { JsonDataFormat } from "./db/json_format";
import { TextParser } from "./views/parser";
import { FrontMatterManager } from "./utils/frontmatter";
import { MdictEngine, createMdictEngine } from "./dictionary/mdict/engine";

import { DEFAULT_SETTINGS, MyPluginSettings, SettingTab, StorageType } from "./settings";
import store from "./store";
import { playAudio } from "./utils/helpers";
import type { Position } from "./constant";
import { InputModal, AudioFileSuggestModal } from "./modals"
import { dicts } from "./dictionary/list";

import Global from "./views/Global.vue";



export const FRONT_MATTER_KEY: string = "langr";

// 导出图片路径前缀变量（用于阅读模式渲染本地图片）
export let imgnum: string = "";

/**
 * Language Learner 主插件类
 * 负责管理插件的生命周期、视图注册、事件处理等
 */
export default class LanguageLearner extends Plugin {
    // 基础常量（路径、平台）
    constants: { basePath: string; platform: "mobile" | "desktop"; };
    // 插件设置
    settings: MyPluginSettings;
    // 全局 Vue App 挂载点（用于浮动元素如弹窗查词）
    appEl: HTMLElement;
    vueApp: VueApp;
    // 数据库实例（本地 IndexedDB 或远程服务器）
    db: DbProvider;
    // 文本解析器（英文分词、短语识别）
    parser: TextParser;
    // Markdown 视图按钮缓存
    markdownButtons: Record<string, HTMLElement> = {};
    // Frontmatter 管理器
    frontManager: FrontMatterManager;
    // MDict 离线词典引擎
    mdictEngine: MdictEngine | null = null;
    // Vue 响应式状态
    store: typeof store = store;

    async onload() {
        // 读取设置
        await this.loadSettings();
        this.addSettingTab(new SettingTab(this.app, this));

        this.registerConstants();

        // 打开数据库
        await this.initDatabase();

        // 设置解析器
        this.parser = new TextParser(this);
        this.frontManager = new FrontMatterManager(this.app);

        // 初始化 MDict 引擎（支持桌面端和移动端）
        this.mdictEngine = createMdictEngine(this.constants.basePath, this.app.vault);
        // 自动加载第一个已启用的词典
        const mdictPaths = this.settings.mdict_paths;
        if (mdictPaths && mdictPaths.length > 0) {
            const firstEnabled = mdictPaths.find((d: any) => d.enabled);
            if (firstEnabled) {
                this.mdictEngine.loadDictionary(firstEnabled.path);
            }
        }

        // test
        // this.addCommand({
        // 	id: "langr-test",
        // 	name: "Test for langr",
        // 	callback: () => new Notice("hello!")
        // })

        // await this.replacePDF();

        this.initStore();

        this.addCommands();
        this.registerCustomViews();
        this.registerReadingToggle();
        this.registerContextMenu();
        this.registerLeftClick();
        this.registerMouseup();
        this.registerEvent(
            this.app.workspace.on("css-change", () => {
                store.dark = document.body.hasClass("theme-dark");
                store.themeChange = !store.themeChange;
            })
        );

        // 创建全局app用于各种浮动元素
        this.appEl = document.body.createDiv({ cls: "langr-app" });
        this.vueApp = createApp(Global);
        this.vueApp.config.globalProperties.plugin = this;
        this.vueApp.mount(this.appEl);
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(SEARCH_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(LEARN_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(DATA_PANEL_VIEW);
        // this.app.workspace.detachLeavesOfType(STAT_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(READING_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(MDICT_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(ANKI_EXPORT_VIEW);
        this.app.workspace.detachLeavesOfType(REVIEW_PANEL_VIEW);

        this.db.close();
        this.mdictEngine?.close();

        this.vueApp.unmount();
        this.appEl.remove();
        this.appEl = null;
    }

    registerConstants() {
        this.constants = {
            basePath: normalizePath((this.app.vault.adapter as any).basePath),
            platform: Platform.isMobile ? "mobile" : "desktop",
        };
    }

    /**
     * 初始化数据库
     * 根据设置选择存储类型
     */
    async initDatabase() {
        // 检查是否需要从 Markdown 迁移
        await this.checkAndMigrateMarkdown();

        this.db = this.createDatabase(this.settings.storage_type);
        await this.db.open();
    }

    /**
     * 检查并迁移 Markdown 数据
     */
    private async checkAndMigrateMarkdown(): Promise<void> {
        const mdPath = "Language Learner/words.md";
        const jsonPath = this.settings.json_db_path;

        // 检查是否需要迁移
        const needsMigration = await DataMigration.checkMigrationNeeded(mdPath, jsonPath, this.app.vault);

        if (needsMigration) {
            console.log("[LanguageLearner] Detected Markdown data, prompting for migration...");

            // 自动执行迁移
            const result = await DataMigration.migrateMarkdownToJson(mdPath, jsonPath, this.app.vault);

            if (result.success) {
                new Notice(`数据迁移完成：${result.expressionsMigrated} 个单词已迁移到 JSON 格式`);
                console.log(`[LanguageLearner] Migration completed: ${result.expressionsMigrated} expressions`);
            } else {
                console.error("[LanguageLearner] Migration failed:", result.errors);
            }
        }
    }

    /**
     * 创建数据库实例
     */
    createDatabase(type: StorageType): DbProvider {
        switch (type) {
            case "json":
                return new JsonSyncDb(this, this.settings.json_db_path, {
                    syncDebounceMs: this.settings.sync_debounce_ms
                });
            case "server":
                return new WebDb(
                    this.settings.host,
                    this.settings.port,
                    this.settings.use_https,
                    this.settings.api_key
                );
            case "indexeddb":
            default:
                return new LocalDb(this);
        }
    }

    /**
     * 切换存储类型
     */
    async switchStorage(type: StorageType) {
        // 关闭旧数据库
        if (this.db) {
            this.db.close();
        }
        // 创建新数据库
        this.db = this.createDatabase(type);
        await this.db.open();
        this.settings.storage_type = type;
    }

    /**
     * 更新 JSON 文件路径
     * 将旧路径的数据迁移到新路径
     */
    async updateJsonPath(newPath: string): Promise<void> {
        const oldPath = this.settings.json_db_path;

        if (oldPath === newPath) {
            return;  // 路径相同，无需处理
        }

        // 检查旧文件是否存在
        const oldFile = this.app.vault.getAbstractFileByPath(oldPath);
        if (oldFile instanceof TFile) {
            // 读取旧文件内容
            const oldContent = await this.app.vault.read(oldFile);
            let oldData: JsonDataFormat | null = null;

            try {
                const parsed = JSON.parse(oldContent);
                if (validateJsonFormat(parsed)) {
                    oldData = parsed;
                }
            } catch (e) {
                console.warn("[LanguageLearner] Old file is not valid JSON:", e);
            }

            // 检查新文件是否已存在
            const newFile = this.app.vault.getAbstractFileByPath(newPath);
            if (newFile instanceof TFile && oldData) {
                // 新文件已存在，合并数据
                const newContent = await this.app.vault.read(newFile);
                try {
                    const newData = JSON.parse(newContent);
                    if (validateJsonFormat(newData)) {
                        // 合并表达式和句子
                        const mergedExpressions = mergeExpressions(
                            oldData.data.expressions,
                            newData.data.expressions
                        );
                        const mergedSentences = mergeSentences(
                            oldData.data.sentences,
                            newData.data.sentences
                        );

                        // 创建合并后的数据
                        const mergedData = createJsonDataFormat(mergedExpressions, mergedSentences);

                        // 写入新文件
                        await this.app.vault.modify(newFile, JSON.stringify(mergedData, null, 2));
                        console.log("[LanguageLearner] Merged data into new file:", newPath);
                    }
                } catch (e) {
                    console.warn("[LanguageLearner] New file is not valid JSON, overwriting:", e);
                    // 新文件不是有效 JSON，直接覆盖
                    await this.app.vault.modify(newFile, oldContent);
                }
            } else {
                // 新文件不存在，创建新文件
                const parentPath = newPath.substring(0, newPath.lastIndexOf('/'));
                if (parentPath) {
                    const folder = this.app.vault.getAbstractFileByPath(parentPath);
                    if (!folder) {
                        await this.app.vault.createFolder(parentPath);
                    }
                }
                await this.app.vault.create(newPath, oldContent);
                console.log("[LanguageLearner] Created new JSON file at:", newPath);
            }
        }

        // 更新设置
        this.settings.json_db_path = newPath;

        // 重新初始化数据库
        if (this.db) {
            this.db.close();
        }
        this.db = this.createDatabase("json");
        await this.db.open();
    }

    // async replacePDF() {
    //     if (await app.vault.adapter.exists(
    //         ".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html"
    //     )) {
    //         this.registerView(VIEW_TYPE_PDF, (leaf) => {
    //             return new PDFView(leaf);
    //         });

    //         (this.app as any).viewRegistry.unregisterExtensions([
    //             PDF_FILE_EXTENSION,
    //         ]);
    //         this.registerExtensions([PDF_FILE_EXTENSION], VIEW_TYPE_PDF);

    //         this.registerDomEvent(window, "message", (evt) => {
    //             if (evt.data.type === "search") {
    //                 // if (evt.data.funckey || this.store.searchPinned)
    //                 this.queryWord(evt.data.selection);
    //             }
    //         });
    //     }
    // }

    initStore() {
        this.store.dark = document.body.hasClass("theme-dark");
        this.store.themeChange = false;
        this.store.fontSize = this.settings.font_size;
        this.store.fontFamily = this.settings.font_family;
        this.store.lineHeight = this.settings.line_height;
        this.store.popupSearch = this.settings.popup_search;
        this.store.searchPinned = false;
        this.store.dictsChange = false;
        this.store.dictHeight = this.settings.dict_height;
    }

    addCommands() {
        // 注册刷新单词数据库命令
        this.addCommand({
            id: "langr-refresh-word-database",
            name: t("Refresh Word Database"),
            callback: this.refreshWordDb,
        });

        // 注册刷新复习数据库命令
        this.addCommand({
            id: "langr-refresh-review-database",
            name: t("Refresh Review Database"),
            callback: this.refreshReviewDb,
        });

        // 注册查词命令
        this.addCommand({
            id: "langr-search-word-select",
            name: t("Translate Select"),
            callback: () => {
                let selection = window.getSelection().toString().trim();
                this.queryWord(selection);
            },
        });
        this.addCommand({
            id: "langr-search-word-input",
            name: t("Translate Input"),
            callback: () => {
                const modal = new InputModal(this.app, (text) => {
                    this.queryWord(text);
                });
                modal.open();
            },
        });

        // 注册设置音频命令
        this.addCommand({
            id: "langr-set-article-audio",
            name: t("Set Article Audio"),
            callback: () => {
                this.setArticleAudio();
            },
        });

        // 注册打开离线词典命令（仅桌面端）
        if (Platform.isDesktopApp) {
            this.addCommand({
                id: "langr-open-mdict-panel",
                name: t("Open Offline Dictionary"),
                callback: () => {
                    this.activateView(MDICT_PANEL_VIEW, "left");
                },
            });
        }

        // 注册打开 Anki 导出面板命令（仅桌面端）
        if (Platform.isDesktopApp) {
            this.addCommand({
                id: "langr-open-anki-export",
                name: t("Open Anki Export"),
                callback: () => {
                    this.activateView(ANKI_EXPORT_VIEW, "right");
                },
            });
        }

        // 注册打开智能复习面板命令
        this.addCommand({
            id: "langr-open-review-panel",
            name: t("Open Smart Review"),
            callback: () => {
                this.activateView(REVIEW_PANEL_VIEW, "right");
            },
        });
    }

    registerCustomViews() {
        // 注册查词面板视图
        this.registerView(
            SEARCH_PANEL_VIEW,
            (leaf) => new SearchPanelView(leaf, this)
        );
        this.addRibbonIcon(SEARCH_ICON, t("Open word search panel"), (evt) => {
            this.activateView(SEARCH_PANEL_VIEW, "left");
        });

        // 注册新词面板视图
        this.registerView(
            LEARN_PANEL_VIEW,
            (leaf) => new LearnPanelView(leaf, this)
        );
        this.addRibbonIcon(LEARN_ICON, t("Open new word panel"), (evt) => {
            this.activateView(LEARN_PANEL_VIEW, "right");
        });

        // 注册阅读视图
        this.registerView(
            READING_VIEW_TYPE,
            (leaf) => new ReadingView(leaf, this)
        );

        //注册统计视图（已禁用）
        // this.registerView(STAT_VIEW_TYPE, (leaf) => new StatView(leaf, this));
        // this.addRibbonIcon(STAT_ICON, t("Open statistics"), async (evt) => {
        //     this.activateView(STAT_VIEW_TYPE, "right");
        // });

        //注册单词列表视图
        this.registerView(
            DATA_PANEL_VIEW,
            (leaf) => new DataPanelView(leaf, this)
        );
        this.addRibbonIcon(DATA_ICON, t("Data Panel"), async (evt) => {
            this.activateView(DATA_PANEL_VIEW, "tab");
        });

        // 注册格式化文章的侧边栏按钮
        this.addRibbonIcon("wand", t("Format for Reading"), async (evt) => {
            await this.formatArticleForReading();
        });

        // 注册 MDict 离线词典面板（仅桌面端）
        if (Platform.isDesktopApp) {
            this.registerView(
                MDICT_PANEL_VIEW,
                (leaf) => new MdictPanelView(leaf, this)
            );
            this.addRibbonIcon(MDICT_ICON, t("Offline Dictionary"), (evt) => {
                this.activateView(MDICT_PANEL_VIEW, "left");
            });
        }

        // 注册 Anki 导出面板（仅桌面端）
        if (Platform.isDesktopApp) {
            this.registerView(
                ANKI_EXPORT_VIEW,
                (leaf) => new AnkiExportView(leaf, this)
            );
            this.addRibbonIcon(ANKI_EXPORT_ICON, t("Anki Export"), (evt) => {
                this.activateView(ANKI_EXPORT_VIEW, "right");
            });
        }

        // 注册智能复习面板
        this.registerView(
            REVIEW_PANEL_VIEW,
            (leaf) => new ReviewPanelView(leaf, this)
        );
        this.addRibbonIcon(REVIEW_ICON, t("Smart Review"), (evt) => {
            this.activateView(REVIEW_PANEL_VIEW, "right");
        });
    }

    async setMarkdownView(leaf: WorkspaceLeaf, focus: boolean = true) {
        await leaf.setViewState(
            {
                type: "markdown",
                state: leaf.view.getState(),
                //popstate: true,
            } as ViewState,
            { focus }
        );
    }

    async setReadingView(leaf: WorkspaceLeaf) {
        await leaf.setViewState({
            type: READING_VIEW_TYPE,
            state: leaf.view.getState(),
            //popstate: true,
        } as ViewState);
    }

    async refreshTextDB() {
        await this.refreshWordDb();
        await this.refreshReviewDb();
        (this.app as any).commands.executeCommandById(
            "various-complements:reload-custom-dictionaries"
        );
    }

    refreshWordDb = async () => {
        if (!this.settings.word_database) {
            return;
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.word_database
        );
        if (!dataBase || dataBase.hasOwnProperty("children")) {
            new Notice("Invalid refresh database path");
            return;
        }
        // 获取所有非无视单词的简略信息
        let words = await this.db.getAllExpressionSimple(false);

        let classified: number[][] = Array(5)
            .fill(0)
            .map((_) => []);
        words.forEach((word, i) => {
            classified[word.status].push(i);
        });

        const statusMap = [
            t("Ignore"),
            t("Learning"),
            t("Familiar"),
            t("Known"),
            t("Learned"),
        ];

        let del = this.settings.col_delimiter;

        // 正向查询
        let classified_texts = classified.map((w, idx) => {
            return (
                `#### ${statusMap[idx]}\n` +
                w.map((i) => `${words[i].expression}${del}    ${words[i].meaning}`)
                    .join("\n") + "\n"
            );
        });
        classified_texts.shift();
        let word2Meaning = classified_texts.join("\n");

        // 反向查询
        let meaning2Word = classified
            .flat()
            .map((i) => `${words[i].meaning}  ${del}  ${words[i].expression}`)
            .join("\n");

        let text = word2Meaning + "\n\n" + "#### 反向查询\n" + meaning2Word;
        let db = dataBase as TFile;
        this.app.vault.modify(db, text);
    };

    refreshReviewDb = async () => {
        if (!this.settings.review_database) {
            return;
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.review_database
        );
        if (!dataBase || "children" in dataBase) {
            new Notice("Invalid word database path");
            return;
        }

        let db = dataBase as TFile;
        let text = await this.app.vault.read(db);
        let oldRecord = {} as { [K in string]: string };
        text.match(/#word(\n.+)+\n(<!--SR.*?-->)/g)
            ?.map((v) => v.match(/#### (.+)[\s\S]+(<!--SR.*-->)/))
            ?.forEach((v) => {
                oldRecord[v[1]] = v[2];
            });

        // let data = await this.db.getExpressionAfter(this.settings.last_sync)
        let data = await this.db.getExpressionAfter("1970-01-01T00:00:00Z");
        if (data.length === 0) {
            // new Notice("Nothing new")
            return;
        }

        data.sort((a, b) => a.expression.localeCompare(b.expression));

        let newText = data.map((word) => {
            let notes = word.notes.length === 0
                ? ""
                : "**Notes**:\n" + word.notes.join("\n").trim() + "\n";
            let sentences = word.sentences.length === 0
                ? ""
                : "**Sentences**:\n" +
                word.sentences.map((sen) => {
                    return (
                        `*${sen.text.trim()}*` + "\n" +
                        (sen.trans ? sen.trans.trim() + "\n" : "") +
                        (sen.origin ? sen.origin.trim() : "")
                    );
                }).join("\n").trim() + "\n";

            return (
                `#word\n` +
                `#### ${word.expression}\n` +
                `${this.settings.review_delimiter}\n` +
                `${word.meaning}\n` +
                `${notes}` +
                `${sentences}` +
                (oldRecord[word.expression] ? oldRecord[word.expression] + "\n" : "")
            );
        }).join("\n") + "\n";

        newText = "#flashcards\n\n" + newText;
        await this.app.vault.modify(db, newText);

        this.saveSettings();
    };

    // 在MardownView的扩展菜单加一个转为Reading模式的选项
    registerReadingToggle = () => {
        const pluginSelf = this;
        pluginSelf.register(
            around(MarkdownView.prototype, {
                onPaneMenu(next) {
                    return function (m: Menu) {
                        const file = this.file;
                        const cache = file.cache
                            ? pluginSelf.app.metadataCache.getFileCache(file)
                            : null;

                        if (!file ||
                            !cache?.frontmatter ||
                            !cache?.frontmatter[FRONT_MATTER_KEY]
                        ) {
                            return next.call(this, m);
                        }

                        m.addItem((item) => {
                            item.setTitle(t("Open as Reading View"))
                                .setIcon(READING_ICON)
                                .onClick(() => { pluginSelf.setReadingView(this.leaf); });
                        });

                        next.call(this, m);
                    };
                },
            })
        );

        // 增加标题栏切换阅读模式和mardown模式的按钮
        pluginSelf.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(next) {
                    return function (state: ViewState, ...rest: any[]): Promise<void> {
                        return (next.apply(this, [state, ...rest]) as Promise<void>).then(() => {
                            if (state.type === "markdown" && state.state?.file) {
                                const cache = pluginSelf.app.metadataCache
                                    .getCache(state.state.file);
                                // 检测图片路径前缀（用于阅读模式渲染本地图片）
                                // 遍历页面上的 img 标签，获取第一个非 HTTP 的本地图片路径
                                const imgElements = document.getElementsByTagName('img');
                                for (let i = 0; i < imgElements.length; i++) {
                                    const src = imgElements[i].getAttribute('src');
                                    if (src && !src.includes('http')) {
                                        imgnum = src;
                                        break;
                                    }
                                }

                                if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
                                    if (!pluginSelf.markdownButtons["reading"]) {
                                        // 在软件初始化的时候，view上面可能没有 addAction 这个方法
                                        setTimeout(() => {
                                            pluginSelf.markdownButtons["reading"] =
                                                (this.view as MarkdownView).addAction(
                                                    "view",
                                                    t("Open as Reading View"),
                                                    () => {
                                                        pluginSelf.setReadingView(this);
                                                    }
                                                );
                                            pluginSelf.markdownButtons["reading"].addClass("change-to-reading");

                                        })
                                    }
                                } else {
                                    // 在软件初始化的时候，view上面可能没有 actionsEl 这个字段
                                    (this.view.actionsEl as HTMLElement)
                                        ?.querySelectorAll(".change-to-reading")
                                        .forEach(el => el.remove());
                                    // pluginSelf.markdownButtons["reading"]?.remove();
                                    pluginSelf.markdownButtons["reading"] = null;
                                }
                            } else {
                                pluginSelf.markdownButtons["reading"] = null;
                            }
                        });
                    };
                },
            })
        );
    };

    async queryWord(word: string, target?: HTMLElement, evtPosition?: Position): Promise<void> {
        if (!word) return;

        // 根据设置决定默认激活哪个词典面板
        const defaultDict = this.settings.default_dict;

        // 在线词典面板
        if (!this.settings.popup_search || defaultDict === "online") {
            await this.activateView(SEARCH_PANEL_VIEW, "left");
        }

        // 离线词典面板（仅桌面端）
        if (Platform.isDesktopApp && this.mdictEngine?.isLoaded()) {
            if (defaultDict === "offline") {
                await this.activateView(MDICT_PANEL_VIEW, "left");
            }
            // 发送事件给离线词典
            dispatchEvent(new CustomEvent('obsidian-mdict-search', {
                detail: { selection: word }
            }));
        }

        if (target && Platform.isDesktopApp) {
            await this.activateView(LEARN_PANEL_VIEW, "right");
        }

        // 发送事件给在线词典
        dispatchEvent(new CustomEvent('obsidian-langr-search', {
            detail: { selection: word, target, evtPosition }
        }));

        if (this.settings.auto_pron) {
            let accent = this.settings.review_prons;
            let wordUrl =
                `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                encodeURIComponent(word);
            playAudio(wordUrl);
        }
    }

    // 管理所有的右键菜单
    registerContextMenu() {
        let addMemu = (mu: Menu, selection: string) => {
            mu.addItem((item) => {
                item.setTitle(t("Search word"))
                    .setIcon("info")
                    .onClick(async () => {
                        this.queryWord(selection);
                    });
            });
        };
        // markdown 编辑模式 右键菜单
        this.registerEvent(
            this.app.workspace.on(
                "editor-menu",
                (menu: Menu, editor: Editor, view: MarkdownView) => {
                    let selection = editor.getSelection();
                    if (selection || selection.trim().length === selection.length) {
                        addMemu(menu, selection);
                    }
                }
            )
        );
        // markdown 预览模式 右键菜单
        this.registerDomEvent(document.body, "contextmenu", (evt) => {
            if ((evt.target as HTMLElement).matchParent(".markdown-preview-view")) {
                const selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.preventDefault();
                let menu = new Menu();

                addMemu(menu, selection);

                menu.showAtMouseEvent(evt);
            }
        });
    }

    // 管理所有的左键抬起
    registerMouseup() {
        this.registerDomEvent(document.body, "pointerup", (evt) => {
            const target = evt.target as HTMLElement;
            if (!target.matchParent(".stns")) {
                // 处理普通模式
                const funcKey = this.settings.function_key;
                if ((funcKey === "disable" || evt[funcKey] === false)
                    && !(this.store.searchPinned && !target.matchParent("#langr-search,#langr-learn-panel"))
                ) return;

                let selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.stopImmediatePropagation();
                this.queryWord(selection, null, { x: evt.pageX, y: evt.pageY });
                return;
            }
        });
    }

    // 管理所有的鼠标左击
    registerLeftClick() {
        this.registerDomEvent(document.body, "click", (evt) => {
            let target = evt.target as HTMLElement;
            if (
                target.tagName === "H4" &&
                target.matchParent(".sr-modal-content")
            ) {
                let word = target.textContent;
                let accent = this.settings.review_prons;
                let wordUrl =
                    `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                    encodeURIComponent(word);
                playAudio(wordUrl);
            }
        });
    }

    async loadSettings() {
        let settings: { [K in string]: any } = Object.assign(
            {},
            DEFAULT_SETTINGS
        );
        let data = (await this.loadData()) || {};

        // 首先处理旧版本迁移（在赋值之前）
        // 如果 storage_type 是 "markdown"，迁移到 "json"
        if (data.storage_type === "markdown") {
            data.storage_type = "json";
            // 如果有旧的 md_db_path，迁移到 json_db_path
            if (data.md_db_path) {
                data.json_db_path = data.md_db_path.replace(/\.md$/, ".json");
            }
            // 删除旧字段
            delete data.md_db_path;
        }

        // 验证 storage_type 是否有效（必须明确是有效值之一）
        const validStorageTypes = ["json", "indexeddb", "server"];
        if (!validStorageTypes.includes(data.storage_type)) {
            data.storage_type = "json";  // 使用默认值
        }

        // 确保 json_db_path 和 sync_debounce_ms 有默认值
        if (typeof data.json_db_path !== 'string' || !data.json_db_path) {
            data.json_db_path = DEFAULT_SETTINGS.json_db_path;
        }
        if (typeof data.sync_debounce_ms !== 'number') {
            data.sync_debounce_ms = DEFAULT_SETTINGS.sync_debounce_ms;
        }

        // 从 data 复制到 settings
        for (let key in DEFAULT_SETTINGS) {
            let k = key as keyof typeof DEFAULT_SETTINGS;
            if (data[k] === undefined || data[k] === null) {
                continue;
            }

            if (typeof DEFAULT_SETTINGS[k] === "object" && DEFAULT_SETTINGS[k] !== null) {
                Object.assign(settings[k], data[k]);
            } else {
                settings[k] = data[k];
            }
        }

        // 清理不存在的词典设置（如已删除的 jukuu）
        const validDicts = Object.keys(dicts);
        const savedDicts = Object.keys(settings.dictionaries || {});
        for (const dict of savedDicts) {
            if (!validDicts.includes(dict)) {
                delete settings.dictionaries[dict];
            }
        }

        // 添加新增的词典设置
        for (const dict of validDicts) {
            if (!settings.dictionaries[dict]) {
                settings.dictionaries[dict] = { enable: true, priority: validDicts.indexOf(dict) + 1 };
            }
        }

        // 赋值给 this.settings
        this.settings = settings as MyPluginSettings;

        // 设置插件界面语言
        setLanguage(settings.ui_language || "zh");
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(VIEW_TYPE: string, side: "left" | "right" | "tab") {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
            let leaf;
            switch (side) {
                case "left":
                    leaf = this.app.workspace.getLeftLeaf(false);
                    break;
                case "right":
                    leaf = this.app.workspace.getRightLeaf(false);
                    break;
                case "tab":
                    leaf = this.app.workspace.getLeaf("tab");
                    break;
            }
            await leaf.setViewState({
                type: VIEW_TYPE,
                active: true,
            });
        }
        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
        );
    }

    /**
     * 格式化当前文章为阅读模式格式
     * 添加 langr: true 属性，以及 ^^^article, ^^^words, ^^^notes 分隔符
     * 同时弹出音频文件选择器
     */
    async formatArticleForReading(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            new Notice(t("No active file"));
            return;
        }

        if (activeFile.extension !== "md") {
            new Notice(t("Only Markdown files are supported"));
            return;
        }

        const cache = this.app.metadataCache.getFileCache(activeFile);

        // 检查是否已经有 langr 属性
        if (cache?.frontmatter?.[FRONT_MATTER_KEY]) {
            new Notice(t("File already formatted for reading"));
            return;
        }

        // 弹出音频文件选择器
        new AudioFileSuggestModal(this.app, async (audioFile) => {
            let content = await this.app.vault.read(activeFile);
            let newContent: string;

            // 检查是否有 frontmatter
            const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);

            if (frontMatterMatch) {
                // 已有 frontmatter，添加 langr: true 和音频路径
                const existingFm = frontMatterMatch[1];
                let newFm = existingFm + "\nlangr: true";
                if (audioFile) {
                    newFm += `\nlangr-audio: ~/${audioFile.path}`;
                }
                const afterFm = content.slice(frontMatterMatch[0].length);

                // 在 frontmatter 后添加 ^^^article
                newContent = `---\n${newFm}\n---\n^^^article\n${afterFm}`;
            } else {
                // 没有 frontmatter，创建新的
                let fm = "langr: true";
                if (audioFile) {
                    fm += `\nlangr-audio: ~/${audioFile.path}`;
                }
                newContent = `---\n${fm}\n---\n^^^article\n${content}`;
            }

            // 在文末添加 ^^^words 和 ^^^notes
            // 先移除末尾可能的空白行，然后添加分隔符
            newContent = newContent.trimEnd();
            newContent += "\n\n^^^words\n\n\n\n^^^notes\n";

            await this.app.vault.modify(activeFile, newContent);
            new Notice(t("Article formatted for reading"));
        }).open();
    }

    /**
     * 设置或修改当前文章的音频文件
     */
    async setArticleAudio(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            new Notice(t("No active file"));
            return;
        }

        if (activeFile.extension !== "md") {
            new Notice(t("Only Markdown files are supported"));
            return;
        }

        // 弹出音频文件选择器
        new AudioFileSuggestModal(this.app, async (audioFile) => {
            if (audioFile) {
                // 设置音频路径
                await this.frontManager.setFrontMatter(
                    activeFile,
                    "langr-audio",
                    `~/${audioFile.path}`
                );
                new Notice(t("Audio file set"));
            }
        }).open();
    }
}
