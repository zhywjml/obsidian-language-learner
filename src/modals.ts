import { App, Modal, Setting, FuzzySuggestModal, TFile } from "obsidian";
import { t } from "./lang/helper";

// 输入文字
class InputModal extends Modal {
    text: string = "";
    onSubmit: (text: string) => void;
    constructor(app: App, onSubmit: (text: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", {
            text: "Input Text",
            attr: {
                style: "margin: 10px 0;",
            }
        });

        let inputEl = contentEl.createEl("input", {
            attr: {
                type: "text",
                style: "width: 100%;"
            }
        });

        inputEl.addEventListener("input", (evt) => {
            this.text = inputEl.value;
        });

        inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
                evt.preventDefault();
                evt.stopPropagation();
                this.onSubmit(this.text);
                this.close();
            }
        });
    }
}

// 打开某个文件
class OpenFileModal extends Modal {
    input: HTMLInputElement;
    file: File;
    onSubmit: (file: File) => Promise<void>;
    constructor(app: App, onSubmit: (file: File) => Promise<void>) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        this.input = contentEl.createEl("input", {
            attr: {
                type: "file"
            }
        });

        this.input.addEventListener("change", () => {
            this.file = this.input.files[0];
        });

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(t("Yes"))
                .onClick((evt) => {
                    this.onSubmit(this.file);
                    this.close();
                })
            );
    }

    onClose(): void {

    }
}

// 做某些危险操作前问一句
class WarningModal extends Modal {
    onSubmit: () => Promise<void>;
    message: string;

    constructor(app: App, message: string, onSubmit: () => Promise<void>) {
        super(app);
        this.message = message;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.message });

        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText(t("Yes"))
                .setWarning()
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit();
                })
            )
            .addButton((btn) => btn
                .setButtonText(t("No!!!"))
                .setCta() // what is this?
                .onClick(() => {
                    this.close();
                }));
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}

// Markdown 文件选择器
class MarkdownFileSuggestModal extends FuzzySuggestModal<TFile> {
    files: TFile[];
    onSelect: (file: TFile) => void;

    constructor(app: App, onSelect: (file: TFile) => void) {
        super(app);
        this.onSelect = onSelect;
        // 获取所有 Markdown 文件
        this.files = app.vault.getMarkdownFiles();
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(file);
    }
}

// 音频文件选择器
class AudioFileSuggestModal extends FuzzySuggestModal<TFile> {
    files: TFile[];
    private onSelect: (file: TFile | null) => void;
    private selected = false;
    // 支持的音频格式
    static AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"];

    constructor(app: App, onSelect: (file: TFile | null) => void) {
        super(app);
        this.onSelect = onSelect;
        // 获取所有音频文件
        this.files = this.getAudioFiles();
        // 设置提示文本
        this.setPlaceholder(t("Select an audio file or press Esc to skip"));
    }

    getAudioFiles(): TFile[] {
        const allFiles = this.app.vault.getFiles();
        return allFiles.filter(file =>
            AudioFileSuggestModal.AUDIO_EXTENSIONS.includes(file.extension.toLowerCase())
        );
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.selected = true;
        this.onSelect(file);
    }

    onClose(): void {
        // 如果用户按 Esc 关闭（没有选择），返回 null
        if (!this.selected) {
            this.onSelect(null);
        }
    }
}

// MDX 词典文件选择器
class MdictFileSuggestModal extends FuzzySuggestModal<TFile> {
    files: TFile[];
    private onSelect: (file: TFile) => void;
    // 支持的词典格式
    static MDICT_EXTENSIONS = ["mdx", "mdd"];

    constructor(app: App, onSelect: (file: TFile) => void) {
        super(app);
        this.onSelect = onSelect;
        // 获取所有 MDX/MDD 文件
        this.files = this.getMdictFiles();
        // 设置提示文本
        this.setPlaceholder(t("Select a MDX dictionary file"));
    }

    getMdictFiles(): TFile[] {
        const allFiles = this.app.vault.getFiles();
        return allFiles.filter(file =>
            MdictFileSuggestModal.MDICT_EXTENSIONS.includes(file.extension.toLowerCase())
        );
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(file);
    }
}

export { OpenFileModal, WarningModal, InputModal, MarkdownFileSuggestModal, AudioFileSuggestModal, MdictFileSuggestModal };