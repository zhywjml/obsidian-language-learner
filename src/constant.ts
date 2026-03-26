import { t } from "./lang/helper";

// 鼠标位置（用于弹窗定位）
type Position = {
    x: number;
    y: number;
};

/**
 * 自定义事件类型定义
 *
 * - obsidian-langr-search: 查词事件，触发查词面板
 * - obsidian-langr-refresh: 刷新事件，更新单词状态
 * - obsidian-langr-refresh-stat: 统计刷新事件
 */
interface EventMap extends GlobalEventHandlersEventMap {
    "obsidian-langr-search": CustomEvent<{
        selection: string,
        target?: HTMLElement,
        evtPosition?: Position,
    }>;
    "obsidian-langr-refresh": CustomEvent<{
        expression: string,
        type: string,
        status: number,
    }>;
    "obsidian-langr-refresh-stat": CustomEvent<{}>;
}



export type { EventMap, Position }


