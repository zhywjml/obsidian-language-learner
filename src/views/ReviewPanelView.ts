/**
 * 复习面板视图
 * 基于SM-2算法的智能复习系统
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createApp, App as VueApp } from "vue";
import LanguageLearner from "@/plugin";
import ReviewPanel from "./ReviewPanel.vue";

export const REVIEW_PANEL_VIEW = "review-panel-view";
export const REVIEW_ICON = "brain"; // Lucide brain icon

export class ReviewPanelView extends ItemView {
    plugin: LanguageLearner;
    vueApp: VueApp | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return REVIEW_PANEL_VIEW;
    }

    getDisplayText(): string {
        return "智能复习";
    }

    getIcon(): string {
        return REVIEW_ICON;
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // 创建Vue应用挂载点
        const mountPoint = container.createDiv({ cls: "review-panel-container" });
        mountPoint.style.height = "100%";

        // 挂载Vue应用
        this.vueApp = createApp(ReviewPanel);
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
