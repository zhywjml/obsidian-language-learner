/**
 * 插件设置模块
 *
 * 定义所有设置项及其默认值，包含设置面板 UI 实现
 * 主要设置分组：
 * - 后端服务器设置（可选）
 * - 语言设置（母语/外语）
 * - 查词设置（词典、快捷键等）
 * - 数据库设置（IndexedDB）
 * - 阅读模式设置
 * - 自动补全设置
 * - 复习设置
 */

import { App, Notice, PluginSettingTab, Setting, Modal, moment, debounce } from "obsidian";

import { WebDb } from "./db/web_db";
import { LocalDb } from "./db/local_db";
import { MarkdownDb } from "./db/markdown_db";
import LanguageLearner from "./plugin";
import { t } from "./lang/helper";
import { WarningModal, OpenFileModal, MarkdownFileSuggestModal, MdictFileSuggestModal } from "./modals"
import { dicts } from "@dict/list";
import store from "./store";

// 存储类型
export type StorageType = "indexeddb" | "markdown" | "server";

export interface MyPluginSettings {
    // storage
    storage_type: StorageType;
    md_db_path: string;  // Markdown 文件存储路径
    // server
    use_server: boolean;
    host: string,
    port: number;
    use_https: boolean;
    api_key: string,
    // lang
    native: string;
    foreign: string;
    // search
    popup_search: boolean;
    auto_pron: boolean;
    function_key: "ctrlKey" | "altKey" | "metaKey" | "disable";
    dictionaries: { [K in string]: { enable: boolean, priority: number; } };
    dict_height: string;
    // reading
    word_count: boolean;
    default_paragraphs: string;
    font_size: string;
    font_family: string;
    line_height: string;
    word_spacing: string;
    use_machine_trans: boolean;
    // indexed db
    db_name: string;
    // text db
    word_database: string;
    review_database: string;
    col_delimiter: "," | "\t" | "|";
    auto_refresh_db: boolean;
    // review
    review_prons: "0" | "1";
    review_delimiter: string;
    // mdict
    mdict_paths: { path: string; enabled: boolean }[];
    // default dictionary for word search
    default_dict: "online" | "offline";
    // anki
    anki_enabled: boolean;
    anki_deck: string;
    anki_model: string;
    anki_host: string;
    anki_port: number;
    anki_api_key: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    // storage
    storage_type: "markdown",  // 默认使用 Markdown 文件（支持 Obsidian Sync）
    md_db_path: "Language Learner/words.md",  // Markdown 文件路径
    // server
    use_server: false,
    port: 8086,
    host: "127.0.0.1",
    use_https: false,
    api_key: "",
    // lang
    native: "zh",
    foreign: "en",
    // search
    popup_search: true,
    auto_pron: true,
    function_key: "ctrlKey",
    dictionaries: {
        "youdao": { enable: true, priority: 1 },
        "cambridge": { enable: true, priority: 2 },
        "jukuu": { enable: true, priority: 3 },
        "hjdict": { enable: true, priority: 4 },
        "deepl": { enable: true, priority: 5 },
    },
    dict_height: "250px",
    // indexed
    db_name: "WordDB",
    // text db
    word_database: "",
    review_database: "",
    col_delimiter: ",",
    auto_refresh_db: true,
    // reading
    default_paragraphs: "4",
    font_size: "15px",
    font_family: '"Times New Roman"',
    line_height: "1.8em",
    word_spacing: "0em",
    use_machine_trans: true,
    word_count: true,
    // review
    review_prons: "0",
    review_delimiter: "?",
    // mdict
    mdict_paths: [],
    // default dictionary
    default_dict: "online",
    // anki
    anki_enabled: false,
    anki_deck: "Language Learner",
    anki_model: "Basic",
    anki_host: "127.0.0.1",
    anki_port: 8765,
    anki_api_key: "",
};

export class SettingTab extends PluginSettingTab {
    plugin: LanguageLearner;

    constructor(app: App, plugin: LanguageLearner) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl("h1", { text: "Settings for Language Learner" });

        this.storageSettings(containerEl);
        this.langSettings(containerEl);
        this.querySettings(containerEl);
        this.mdictSettings(containerEl);
        this.indexedDBSettings(containerEl);
        this.textDBSettings(containerEl);
        this.readingSettings(containerEl);
        this.completionSettings(containerEl);
        this.reviewSettings(containerEl);
        this.ankiSettings(containerEl);
    }

    storageSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Data Storage") });

        new Setting(containerEl)
            .setName(t("Storage Type"))
            .setDesc(t("Markdown file supports Obsidian Sync and can be viewed/edited directly"))
            .addDropdown(dropdown => dropdown
                .addOption("indexeddb", t("IndexedDB (Local)"))
                .addOption("markdown", t("Markdown File (Recommended)"))
                .addOption("server", t("Remote Server"))
                .setValue(this.plugin.settings.storage_type)
                .onChange(async (value: StorageType) => {
                    this.plugin.settings.storage_type = value;
                    await this.plugin.switchStorage(value);
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        // Markdown 文件路径设置
        if (this.plugin.settings.storage_type === "markdown") {
            new Setting(containerEl)
                .setName(t("Markdown File Path"))
                .setDesc(t("Path relative to vault root, e.g. 'Language Learner/words.md'"))
                .addText(text => text
                    .setValue(this.plugin.settings.md_db_path)
                    .setPlaceholder("Language Learner/words.md")
                    .onChange(debounce(async (path) => {
                        if (path.trim()) {
                            this.plugin.settings.md_db_path = path.trim();
                            await this.plugin.switchStorage("markdown");
                            await this.plugin.saveSettings();
                        }
                    }, 1000, true))
                )
                .addButton(button => button
                    .setButtonText("选择文件")
                    .onClick(() => {
                        new MarkdownFileSuggestModal(this.app, async (file) => {
                            this.plugin.settings.md_db_path = file.path;
                            await this.plugin.switchStorage("markdown");
                            await this.plugin.saveSettings();
                            this.display(); // 刷新设置页面
                        }).open();
                    })
                );

            // 迁移按钮
            new Setting(containerEl)
                .setName(t("Migrate Data"))
                .setDesc(t("Migrate from IndexedDB to Markdown file"))
                .addButton(button => button
                    .setButtonText(t("Migrate"))
                    .onClick(async () => {
                        await this.migrateFromIndexedDB();
                    })
                );
        }

        // 服务器设置（当选择 server 时显示）
        if (this.plugin.settings.storage_type === "server") {
            new Setting(containerEl)
                .setName(t("Use https"))
                .setDesc(t("Be sure your server enabled https"))
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.use_https)
                    .onChange(async (use_https) => {
                        this.plugin.settings.use_https = use_https;
                        await this.plugin.saveSettings();
                        this.display();
                    })
                );

            if (this.plugin.settings.use_https) {
                new Setting(containerEl)
                    .setName(t("Api Key"))
                    .setDesc(t("Input your api-key for authentication"))
                    .addText((text) =>
                        text
                            .setValue(this.plugin.settings.api_key)
                            .onChange(debounce(async (api_key) => {
                                this.plugin.settings.api_key = api_key;
                                await this.plugin.saveSettings();
                            }, 500, true))
                    );
            }

            new Setting(containerEl)
                .setName(t("Server Host"))
                .setDesc(t("Your server's host name"))
                .addText((text) =>
                    text
                        .setValue(this.plugin.settings.host)
                        .onChange(debounce(async (host) => {
                            this.plugin.settings.host = host;
                            await this.plugin.saveSettings();
                        }, 500, true))
                );

            new Setting(containerEl)
                .setName(t("Server Port"))
                .setDesc(t("It should be same as 'PORT' variable in .env file of server"))
                .addText((text) =>
                    text
                        .setValue(String(this.plugin.settings.port))
                        .onChange(debounce(async (port) => {
                            let p = Number(port);
                            if (!isNaN(p)) {
                                this.plugin.settings.port = p;
                                await this.plugin.saveSettings();
                            } else {
                                new Notice(t("Wrong port format"));
                            }
                        }, 500, true))
                );
        }

        // 导入导出按钮
        new Setting(containerEl)
            .setName(t("Import & Export"))
            .setDesc(t("Import will override current database"))
            .addButton(button => button
                .setButtonText(t("Import"))
                .onClick(async () => {
                    let modal = new OpenFileModal(this.plugin.app, async (file: File) => {
                        await this.plugin.db.importDB(file);
                        new Notice("Imported");
                    });
                    modal.open();
                })
            )
            .addButton(button => button
                .setButtonText(t("Export"))
                .onClick(async () => {
                    await this.plugin.db.exportDB();
                    new Notice("Exported");
                })
            );
    }

    backendSettings(containerEl: HTMLElement) {
        // 保留此方法以兼容旧设置，但不再在 display 中调用
        // 已由 storageSettings 替代
        new Setting(containerEl)
            .setName(t("Use Server"))
            .setDesc(t("Use a seperated backend server"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.use_server)
                .onChange(async (use_server) => {
                    this.plugin.settings.use_server = use_server;
                    if (use_server) {
                        this.plugin.db.close();
                        this.plugin.db = new WebDb(
                            this.plugin.settings.host,
                            this.plugin.settings.port,
                            this.plugin.settings.use_https,
                            this.plugin.settings.api_key,
                        );
                    } else {
                        this.plugin.db = new LocalDb(this.plugin);
                        await this.plugin.db.open();
                    }
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        new Setting(containerEl)
            .setName(t("Use https"))
            .setDesc(t("Be sure your server enabled https"))
            .addToggle(toggle => toggle
                .setDisabled(this.plugin.settings.use_server)
                .setValue(this.plugin.settings.use_https)
                .onChange(async (use_https) => {
                    this.plugin.settings.use_https = use_https;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        this.plugin.settings.use_https && new Setting(containerEl)
            .setName(t("Api Key"))
            .setDesc(
                t("Input your api-key for authentication")
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.api_key)
                    .setDisabled(this.plugin.settings.use_server)
                    .onChange(debounce(async (api_key) => {
                        this.plugin.settings.api_key = api_key;
                        await this.plugin.saveSettings();
                        this.display();
                    }, 500, true))
            );

        new Setting(containerEl)
            .setName(t("Server Host"))
            .setDesc(
                t("Your server's host name (like 11.11.11.11 or baidu.com)")
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.host)
                    .setDisabled(this.plugin.settings.use_server)
                    .onChange(debounce(async (host) => {
                        this.plugin.settings.host = host;
                        await this.plugin.saveSettings();
                    }, 500, true))
            );

        new Setting(containerEl)
            .setName(t("Server Port"))
            .setDesc(
                // t('An integer between 1024-65535. It should be same as "PORT" variable in .env file of server')
                t('It should be same as "PORT" variable in .env file of server')
            )
            .addText((text) =>
                text
                    .setDisabled(this.plugin.settings.use_server)
                    .setValue(String(this.plugin.settings.port))
                    .onChange(debounce(async (port) => {
                        let p = Number(port);
                        // if (!isNaN(p) && p >= 1023 && p <= 65535) {
                        if (!isNaN(p)) {
                            this.plugin.settings.port = p;
                            (this.plugin.db as WebDb).port = p;
                            await this.plugin.saveSettings();
                        } else {
                            new Notice(t("Wrong port format"));
                        }
                    }, 500, true))
            );
    }

    langSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Language") });

        new Setting(containerEl)
            .setName(t("Native"))
            .addDropdown(native => native
                .addOption("zh", t("Chinese"))
                .setValue(this.plugin.settings.native)
                .onChange(async (value) => {
                    this.plugin.settings.native = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        new Setting(containerEl)
            .setName(t("Foreign"))
            .addDropdown(foreign => foreign
                .addOption("en", t("English"))
                .addOption("jp", t("Japanese"))
                .addOption("kr", t("Korean"))
                .addOption("fr", t("French"))
                .addOption("de", t("Deutsch"))
                .addOption("es", t("Spanish"))
                .setValue(this.plugin.settings.foreign)
                .onChange(async (value) => {
                    this.plugin.settings.foreign = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

    }

    querySettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Translate") });

        new Setting(containerEl)
            .setName(t("Popup Search Panel"))
            .setDesc(t("Use a popup search panel"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.popup_search)
                .onChange(async (value) => {
                    this.plugin.settings.popup_search = value;
                    this.plugin.store.popupSearch = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName(t("Auto pronounce"))
            .setDesc(t("Auto pronounce when searching"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.auto_pron)
                .onChange(async (value) => {
                    this.plugin.settings.auto_pron = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName(t("Word Select"))
            .setDesc(t("Press function key and select text to translate"))
            .addDropdown(funcKey => funcKey
                .addOption("ctrlKey", "Ctrl")
                .addOption("altKey", "Alt")
                .addOption("metaKey", "Meta")
                .addOption("disable", t("Disable"))
                .setValue(this.plugin.settings.function_key)
                .onChange(async (value: "ctrlKey" | "altKey" | "metaKey" | "disable") => {
                    this.plugin.settings.function_key = value;
                    await this.plugin.saveSettings();
                })
            );

        containerEl.createEl("h4", { text: t("Dictionaries") });

        let createDictSetting = (id: string, name: string, description: string) => {
            new Setting(containerEl)
                .setName(name)
                .setDesc(description)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.dictionaries[id].enable)
                    .onChange((value) => {
                        this.plugin.settings.dictionaries[id].enable = value;
                        this.plugin.store.dictsChange = !this.plugin.store.dictsChange;
                        this.plugin.saveSettings();
                    }))
                .addDropdown(num => num
                    .addOption("1", "1")
                    .addOption("2", "2")
                    .addOption("3", "3")
                    .addOption("4", "4")
                    .addOption("5", "5")
                    .addOption("6", "6")
                    .addOption("7", "7")
                    .addOption("8", "8")
                    .addOption("9", "9")
                    .addOption("10", "10")
                    .setValue(this.plugin.settings.dictionaries[id].priority.toString())
                    .onChange(async (value: string) => {
                        this.plugin.settings.dictionaries[id].priority = parseInt(value);
                        this.plugin.store.dictsChange = !this.plugin.store.dictsChange;
                        await this.plugin.saveSettings();
                    })
                );
        };

        Object.keys(dicts).forEach((dict: keyof typeof dicts) => {
            createDictSetting(dict, dicts[dict].name, dicts[dict].description);
        });

        new Setting(containerEl)
            .setName(t("Dictionary Height"))
            .addText(text => text
                .setValue(this.plugin.settings.dict_height)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.dict_height = value;
                    store.dictHeight = value;
                    await this.plugin.saveSettings();
                }, 500))
            );
    }


    indexedDBSettings(containerEl: HTMLElement) {
        if (this.plugin.settings.use_server) {
            return;
        }

        containerEl.createEl("h3", { text: t("IndexDB Database") });

        new Setting(containerEl)
            .setName(t("Database Name"))
            .setDesc(t("Reopen DB after changing database name"))
            .addText(text => text
                .setValue(this.plugin.settings.db_name)
                .onChange(debounce(async (name) => {
                    this.plugin.settings.db_name = name;
                    this.plugin.saveSettings();
                }, 1000, true))
            )
            .addButton(button => button
                .setButtonText(t("Reopen"))
                .onClick(async () => {
                    this.plugin.db.close();
                    this.plugin.db = new LocalDb(this.plugin);
                    await this.plugin.db.open();
                    new Notice("DB is Reopened");
                })
            );


        // 导入导出数据库
        new Setting(containerEl)
            .setName(t("Import & Export"))
            .setDesc(t("Warning: Import will override current database"))
            .addButton(button => button
                .setButtonText(t("Import"))
                .onClick(async () => {
                    let modal = new OpenFileModal(this.plugin.app, async (file: File) => {
                        // let fr = new FileReader()
                        // fr.onload = async () => {
                        // let data = JSON.parse(fr.result as string)
                        await this.plugin.db.importDB(file);
                        new Notice("Imported");
                        // }
                        // fr.readAsText(file)
                    });
                    modal.open();
                })
            )
            .addButton(button => button
                .setButtonText(t("Export"))
                .onClick(async () => {
                    await this.plugin.db.exportDB();
                    new Notice("Exported");
                })
            );
        // 获取所有非无视单词
        new Setting(containerEl)
            .setName(t("Get all non-ignores"))
            .addButton(button => button
                .setButtonText(t("Export Word"))
                .onClick(async () => {
                    let words = await this.plugin.db.getAllExpressionSimple(true);
                    let ignores = words.filter(w => (w.status !== 0 && w.t !== "PHRASE")).map(w => w.expression);
                    await navigator.clipboard.writeText(ignores.join("\n"));
                    new Notice(t("Copied to clipboard"));
                }))
            .addButton(button => button
                .setButtonText(t("Export Word and Phrase"))
                .onClick(async () => {
                    let words = await this.plugin.db.getAllExpressionSimple(true);
                    let ignores = words.filter(w => w.status !== 0).map(w => w.expression);
                    await navigator.clipboard.writeText(ignores.join("\n"));
                    new Notice(t("Copied to clipboard"));
                })
            );

        // 获取所有无视单词
        new Setting(containerEl)
            .setName(t("Get all ignores"))
            .addButton(button => button
                .setButtonText(t("Export"))
                .onClick(async () => {
                    let words = await this.plugin.db.getAllExpressionSimple(true);
                    let ignores = words.filter(w => w.status === 0).map(w => w.expression);
                    await navigator.clipboard.writeText(ignores.join("\n"));
                    new Notice(t("Copied to clipboard"));
                })
            );

        // 销毁数据库
        new Setting(containerEl)
            .setName(t("Destroy Database"))
            .setDesc(t("Destroy all stuff and start over"))
            .addButton(button => button
                .setButtonText(t("Destroy"))
                .setWarning()
                .onClick(async (evt) => {
                    let modal = new WarningModal(
                        this.app,
                        t("Are you sure you want to destroy your database?"),
                        async () => {
                            await this.plugin.db.destroyAll();
                            new Notice("已清空");
                            this.plugin.db = new LocalDb(this.plugin);
                            this.plugin.db.open();
                        });
                    modal.open();
                })
            );
    }

    textDBSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Text Database") });

        new Setting(containerEl)
            .setName(t("Auto refresh"))
            .setDesc(t("Auto refresh database when submitting"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.auto_refresh_db)
                .onChange(async (value) => {
                    this.plugin.settings.auto_refresh_db = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName(t("Word Database Path"))
            .setDesc(t("Choose a md file as word database for auto-completion"))
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.word_database)
                    .onChange(async (path) => {
                        this.plugin.settings.word_database = path;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Review Database Path"))
            .setDesc(t("Choose a md file as review database for spaced-repetition"))
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.review_database)
                    .onChange(async (path) => {
                        this.plugin.settings.review_database = path;
                        await this.plugin.saveSettings();
                    })
            );
    }

    readingSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Reading Mode") });

        new Setting(containerEl)
            .setName(t("Font Size"))
            .setDesc(t("Like 15px or 1.5em"))
            .addText(text => text
                .setValue(this.plugin.settings.font_size)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.font_size = value;
                    this.plugin.store.fontSize = value;
                    await this.plugin.saveSettings();
                }, 500))
            );

        new Setting(containerEl)
            .setName(t("Font Family"))
            .addText(text => text
                .setValue(this.plugin.settings.font_family)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.font_family = value;
                    this.plugin.store.fontFamily = value;
                    await this.plugin.saveSettings();
                }, 500))
            );

        new Setting(containerEl)
            .setName(t("Line Height"))
            .addText(text => text
                .setValue(this.plugin.settings.line_height)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.line_height = value;
                    this.plugin.store.lineHeight = value;
                    await this.plugin.saveSettings();
                }, 500))
            );

        new Setting(containerEl)
            .setName(t("Default Paragraphs"))
            .addDropdown(num => num
                .addOption("2", "1")
                .addOption("4", "2")
                .addOption("8", "4")
                .addOption("16", "8")
                .addOption("32", "16")
                .addOption("all", "All")
                .setValue(this.plugin.settings.default_paragraphs)
                .onChange(async (value: string) => {
                    this.plugin.settings.default_paragraphs = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName(t("Use Machine Translation"))
            .setDesc(t("Auto translate sentences"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.use_machine_trans)
                .onChange(async (use_machine_trans) => {
                    this.plugin.settings.use_machine_trans = use_machine_trans;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(containerEl)
            .setName(t("Open count bar"))
            .setDesc(t("Count the word number of different type of article"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.word_count)
                .onChange(async (value) => {
                    this.plugin.settings.word_count = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    completionSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Auto Completion") });

        new Setting(containerEl)
            .setName(t("Column delimiter"))
            .addDropdown(dilimiter => dilimiter
                .addOption(",", t("Comma"))
                .addOption("\t", t("Tab"))
                .addOption("|", t("Pipe"))
                .setValue(this.plugin.settings.col_delimiter)
                .onChange(async (value: "," | "\t" | "|") => {
                    this.plugin.settings.col_delimiter = value;
                    await this.plugin.saveSettings();
                })
            );

    }

    reviewSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Review") });

        new Setting(containerEl)
            .setName(t("Accent"))
            .setDesc(t("Choose your preferred accent"))
            .addDropdown(accent => accent
                .addOption("0", t("American"))
                .addOption("1", t("British"))
                .setValue(this.plugin.settings.review_prons)
                .onChange(async (value: "0" | "1") => {
                    this.plugin.settings.review_prons = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(containerEl)
            .setName(t("Delimiter"))
            .addText(text => text
                .setValue(this.plugin.settings.review_delimiter)
                .onChange(async (value) => {
                    this.plugin.settings.review_delimiter = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    mdictSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Offline Dictionary") });

        // 默认词典选择
        new Setting(containerEl)
            .setName(t("Default Dictionary"))
            .setDesc(t("Choose which dictionary to show by default when searching words"))
            .addDropdown(dropdown => dropdown
                .addOption("online", t("Online Dictionary"))
                .addOption("offline", t("Offline Dictionary"))
                .setValue(this.plugin.settings.default_dict)
                .onChange(async (value: "online" | "offline") => {
                    this.plugin.settings.default_dict = value;
                    await this.plugin.saveSettings();
                })
            );

        // 词典列表
        const dictListContainer = containerEl.createDiv({ cls: "mdict-list-container" });
        this.renderMdictList(dictListContainer);

        // 添加词典按钮
        new Setting(containerEl)
            .setName(t("Add Dictionary"))
            .setDesc(t("Add a MDX dictionary file"))
            .addButton(button => button
                .setButtonText(t("Select MDX File"))
                .onClick(() => {
                    new MdictFileSuggestModal(this.app, async (file) => {
                        // 检查是否已存在
                        const exists = this.plugin.settings.mdict_paths.some(d => d.path === file.path);
                        if (exists) {
                            new Notice(t("Dictionary already added"));
                            return;
                        }
                        // 添加新词典
                        this.plugin.settings.mdict_paths.push({
                            path: file.path,
                            enabled: true
                        });
                        await this.plugin.saveSettings();
                        this.renderMdictList(dictListContainer);
                    }).open();
                })
            );
    }

    renderMdictList(container: HTMLElement) {
        container.empty();

        const paths = this.plugin.settings.mdict_paths;
        if (paths.length === 0) {
            container.createEl("p", {
                text: t("No dictionary added"),
                cls: "mdict-empty-hint"
            });
            return;
        }

        paths.forEach((dict, index) => {
            const setting = new Setting(container)
                .setName(dict.path.split("/").pop() || dict.path)
                .setDesc(dict.path)
                .addToggle(toggle => toggle
                    .setValue(dict.enabled)
                    .onChange(async (value) => {
                        this.plugin.settings.mdict_paths[index].enabled = value;
                        await this.plugin.saveSettings();
                    })
                );

            // 删除按钮
            setting.addExtraButton(button => button
                .setIcon("trash")
                .setTooltip(t("Remove"))
                .onClick(async () => {
                    this.plugin.settings.mdict_paths.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.renderMdictList(container);
                })
            );

            // 加载按钮
            setting.addExtraButton(button => button
                .setIcon("file-check")
                .setTooltip(t("Load"))
                .onClick(async () => {
                    if (this.plugin.mdictEngine) {
                        const success = await this.plugin.mdictEngine.loadDictionary(dict.path);
                        if (success) {
                            new Notice(t("Dictionary loaded"));
                        }
                    }
                })
            );
        });
    }

    async ankiSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("AnkiConnect") });

        new Setting(containerEl)
            .setName(t("Enable AnkiConnect"))
            .setDesc(t("Enable Anki integration"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.anki_enabled)
                .onChange(async (value) => {
                    this.plugin.settings.anki_enabled = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        if (!this.plugin.settings.anki_enabled) {
            return;
        }

        new Setting(containerEl)
            .setName(t("Anki Host"))
            .setDesc(t("AnkiConnect server host"))
            .addText(text => text
                .setValue(this.plugin.settings.anki_host)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.anki_host = value;
                    await this.plugin.saveSettings();
                }, 500))
            );

        new Setting(containerEl)
            .setName(t("Anki Port"))
            .setDesc(t("AnkiConnect server port (default 8765)"))
            .addText(text => text
                .setValue(String(this.plugin.settings.anki_port))
                .onChange(debounce(async (value) => {
                    const port = Number(value);
                    if (!isNaN(port)) {
                        this.plugin.settings.anki_port = port;
                        await this.plugin.saveSettings();
                    }
                }, 500))
            );

        new Setting(containerEl)
            .setName(t("API Key"))
            .setDesc(t("AnkiConnect API key (optional)"))
            .addText(text => text
                .setValue(this.plugin.settings.anki_api_key)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.anki_api_key = value;
                    await this.plugin.saveSettings();
                }, 500))
            );

        new Setting(containerEl)
            .setName(t("Default Deck"))
            .setDesc(t("Default Anki deck for new cards"))
            .addText(text => text
                .setValue(this.plugin.settings.anki_deck)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.anki_deck = value;
                    await this.plugin.saveSettings();
                }, 500))
            );

        new Setting(containerEl)
            .setName(t("Note Model"))
            .setDesc(t("Anki note model (e.g., Basic, Cloze)"))
            .addText(text => text
                .setValue(this.plugin.settings.anki_model)
                .onChange(debounce(async (value) => {
                    this.plugin.settings.anki_model = value;
                    await this.plugin.saveSettings();
                }, 500))
            );

        // Test connection button
        new Setting(containerEl)
            .setName(t("Test Connection"))
            .addButton(button => button
                .setButtonText(t("Test"))
                .onClick(async () => {
                    const { AnkiConnect } = await import("./anki/anki");
                    const anki = new AnkiConnect(
                        this.plugin.settings.anki_host,
                        this.plugin.settings.anki_port,
                        this.plugin.settings.anki_api_key
                    );
                    try {
                        const result = await anki.connect();
                        if (result) {
                            new Notice(t("AnkiConnect connected successfully"));
                        } else {
                            new Notice(t("AnkiConnect connection failed"));
                        }
                    } catch (e) {
                        new Notice(t("AnkiConnect error: ") + (e as Error).message);
                    }
                })
            );
    }

    /**
     * 从 IndexedDB 迁移数据到 Markdown 文件
     */
    async migrateFromIndexedDB() {
        const { LocalDb } = await import("./db/local_db");
        const { MarkdownDb } = await import("./db/markdown_db");

        // 创建临时 IndexedDB 实例读取数据
        const localDb = new LocalDb(this.plugin);
        await localDb.open();

        // 获取所有数据
        const allWords = await localDb.getAllExpressionSimple(false);

        if (allWords.length === 0) {
            new Notice(t("No data to migrate"));
            localDb.close();
            return;
        }

        // 创建 Markdown 实例
        const mdDb = new MarkdownDb(this.plugin, this.plugin.settings.md_db_path);
        await mdDb.open();

        // 迁移数据
        let count = 0;
        for (const word of allWords) {
            const fullWord = await localDb.getExpression(word.expression);
            if (fullWord) {
                await mdDb.postExpression(fullWord);
                count++;
            }
        }

        localDb.close();
        mdDb.close();

        new Notice(`${t("Migration completed")}: ${count} words`);
    }

}

