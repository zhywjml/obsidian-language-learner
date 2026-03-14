/**
 * MDict 离线词典侧边栏视图
 */

import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import LanguageLearner from '@/plugin';
import { t } from "@/lang/helper";
import { createApp, App } from 'vue';
import MdictPanel from './MdictPanel.vue';

export const MDICT_PANEL_VIEW: string = 'langr-mdict-panel';
export const MDICT_ICON: string = "book-open";

export class MdictPanelView extends ItemView {
    plugin: LanguageLearner;
    vueapp: App;

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return MDICT_PANEL_VIEW;
    }

    getDisplayText(): string {
        return t("Offline Dictionary");
    }

    getIcon(): string {
        return MDICT_ICON;
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        this.vueapp = createApp(MdictPanel);
        this.vueapp.config.globalProperties.plugin = this.plugin;
        this.vueapp.mount(container);
    }

    async onClose() {
        this.vueapp.unmount();
    }
}