import { ItemView, WorkspaceLeaf } from "obsidian";
import { createApp, App } from "vue";
import PluginType from "@/plugin";
import { t } from "@/lang/helper";
import AnkiExportComponent from "./AnkiExport.vue";

export const ANKI_EXPORT_ICON: string = "paper-plane";
export const ANKI_EXPORT_VIEW: string = "langr-anki-export";

export class AnkiExportView extends ItemView {
    plugin: PluginType;
    vueapp: App;

    constructor(leaf: WorkspaceLeaf, plugin: PluginType) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return ANKI_EXPORT_VIEW;
    }

    getDisplayText(): string {
        return t("Anki Export");
    }

    getIcon(): string {
        return ANKI_EXPORT_ICON;
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        this.vueapp = createApp(AnkiExportComponent);
        this.vueapp.config.globalProperties.plugin = this.plugin;
        this.vueapp.mount(container);
    }

    async onClose() {
        this.vueapp.unmount();
        this.vueapp = null;
    }
}