/**
 * 学习热力图面板视图
 * 展示 GitHub 风格的年度学习热力图
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createApp, App as VueApp } from "vue";
import LanguageLearner from "@/plugin";
import { t } from "@/lang/helper";
import HeatmapPanel from "./HeatmapPanel.vue";

export const HEATMAP_PANEL_VIEW = "heatmap-panel-view";
export const HEATMAP_ICON = "flame"; // Lucide flame icon

export class HeatmapPanelView extends ItemView {
    plugin: LanguageLearner;
    vueApp: VueApp | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return HEATMAP_PANEL_VIEW;
    }

    getDisplayText(): string {
        return t("Learning Heatmap");
    }

    getIcon(): string {
        return HEATMAP_ICON;
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // 创建挂载点
        const mountPoint = container.createDiv({ cls: "heatmap-panel-container" });
        mountPoint.style.height = "100%";

        // 挂载 Vue 应用，传递 db 作为 prop
        this.vueApp = createApp(HeatmapPanel, {
            db: this.plugin.db
        });
        this.vueApp.config.globalProperties.view = this;
        this.vueApp.config.globalProperties.plugin = this.plugin;
        this.vueApp.mount(mountPoint);
    }

    async onClose(): Promise<void> {
        if (this.vueApp) {
            this.vueApp.unmount();
            this.vueApp = null;
        }
    }
}
