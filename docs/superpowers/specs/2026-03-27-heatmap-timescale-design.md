# 热力图时间尺度扩展设计文档

**日期**: 2026-03-27
**状态**: 已批准，待实现
**优先级**: 高

---

## 1. 概述

### 1.1 目标
扩展热力图面板的时间尺度展示能力，支持月份网格视图和多年对比视图，让用户能够快速浏览不同时间粒度的学习数据。

### 1.2 背景
当前热力图仅支持单年度GitHub风格视图。用户需要更灵活的时间维度来：
- 快速查看全年各月学习分布
- 对比不同年份的学习情况
- 追踪长期学习趋势

### 1.3 成功标准
- [ ] 月份网格视图正常显示12个月的数据
- [ ] 多年对比视图支持垂直堆叠显示
- [ ] 视图间切换流畅
- [ ] 统计数据准确

---

## 2. 功能设计

### 2.1 视图模式

#### 模式A: 年视图（保留现有）
- GitHub风格52周热力图
- 月份标签、星期标签
- 颜色深度表示学习量
- 点击日期显示当日单词

#### 模式B: 月份网格视图（新增）
- 3行 × 4列的月份卡片网格
- 每个卡片显示:
  - 月份名称 (Jan, Feb, ...)
  - 总学习单词数
  - 背景色根据学习量渐变
- 点击卡片跳转到该月的年视图位置
- 当前月份高亮边框

#### 模式C: 多年对比视图（新增）
- 垂直堆叠显示多年数据
- 每年独立的热力图（简化版，仅显示日期格子）
- 年份标签 + 总学习数
- 支持展开/折叠单年详情
- 默认显示最近3年

### 2.2 视图切换
- 顶部标签栏: [年视图] [月份网格] [多年对比]
- 切换时保持当前年份上下文

### 2.3 统计信息（简单版）
每个时间单元仅显示总学习单词数，不做复杂分析。

---

## 3. 界面设计

### 3.1 整体布局

```
┌─────────────────────────────────────────────┐
│  🔥 学习热力图                    [?]       │
├─────────────────────────────────────────────┤
│  [年视图] [月份网格] [多年对比]    [←] 2025 [→]│
├─────────────────────────────────────────────┤
│                                             │
│  [根据视图模式显示不同内容]                  │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.2 月份网格视图布局

```
┌─────────────────────────────────────────────┐
│                                             │
│    Jan        Feb        Mar        Apr     │
│   ┌──┐      ┌──┐      ┌──┐      ┌──┐       │
│   │45│      │32│      │78│      │12│       │
│   └──┘      └──┘      └──┘      └──┘       │
│                                             │
│    May        Jun        Jul        Aug     │
│   ┌──┐      ┌──┐      ┌──┐      ┌──┐       │
│   │56│      │89│      │120│     │67│       │
│   └──┘      └──┘      └──┘      └──┘       │
│                                             │
│    Sep        Oct        Nov        Dec     │
│   ┌──┐      ┌──┐      ┌──┐      ┌──┐       │
│   │34│      │56│      │23│      │45│       │
│   └──┘      └──┘      └──┘      └──┘       │
│                                             │
└─────────────────────────────────────────────┘
```

卡片样式:
- 背景色根据学习量: `#ebedf0` → `#9be9a8` → `#40c463` → `#30a14e` → `#216e39`
- 当前月份: 边框高亮 `var(--interactive-accent)`
- hover: 轻微放大 + 阴影

### 3.3 多年对比视图布局

```
┌─────────────────────────────────────────────┐
│  [最近3年 ▼]                                │
├─────────────────────────────────────────────┤
│                                             │
│  ▼ 2025年    总计: 523 词                   │
│  ┌─────────────────────────────────────┐   │
│  │ ░░▓▓▓░░▓▓░░▓▓▓▓░░░▓▓░░░▓▓▓░░▓▓▓░░ │   │
│  │ ▓▓░░░▓▓▓░░▓▓░░░▓▓▓▓░░▓▓░░░▓▓▓░░░▓ │   │
│  │ ... (52周 × 7天的简化热力图)        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ▼ 2024年    总计: 412 词                   │
│  ┌─────────────────────────────────────┐   │
│  │ ░░▓▓░░░▓▓▓░░▓▓░░░▓▓░░░▓▓▓░░▓▓░░░▓ │   │
│  │ ...                                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ▼ 2023年    总计: 289 词                   │
│  ┌─────────────────────────────────────┐   │
│  │ ░░░▓▓░░▓▓░░░▓▓░░░▓▓▓░░░▓▓░░▓▓░░░▓ │   │
│  │ ...                                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 4. 数据模型

### 4.1 新增接口

```typescript
// src/db/interface.ts

interface MonthlyStats {
    month: number;      // 1-12
    year: number;
    totalWords: number;
    daysWithActivity: number;
}

interface YearlyStats {
    year: number;
    totalWords: number;
    totalDays: number;
    longestStreak: number;
    monthlyData: MonthlyStats[];
}
```

### 4.2 新增数据库方法

```typescript
// src/db/base.ts 抽象方法
abstract getMonthlyStats(year: number): Promise<MonthlyStats[]>;
abstract getYearlyStats(years: number[]): Promise<YearlyStats[]>;
abstract getAvailableYears(): Promise<number[]>;
```

---

## 5. 组件设计

### 5.1 HeatmapPanel.vue 修改

**新增状态:**
```typescript
type ViewMode = 'year' | 'month-grid' | 'multi-year';

const viewMode = ref<ViewMode>('year');
const monthlyStats = ref<MonthlyStats[]>([]);
const yearlyStatsList = ref<YearlyStats[]>([]);
const availableYears = ref<number[]>([]);
const selectedYears = ref<number[]>([]); // 多年视图中选中的年份
```

**新增组件:**
- `<MonthGrid />` - 月份网格组件
- `<MultiYearView />` - 多年对比组件

### 5.2 新增 MonthGrid.vue 组件

```vue
<template>
  <div class="month-grid">
    <div
      v-for="month in months"
      :key="month.month"
      class="month-card"
      :class="{ 'current-month': isCurrentMonth(month) }"
      @click="selectMonth(month)"
    >
      <div class="month-name">{{ monthLabels[month.month - 1] }}</div>
      <div class="month-count">{{ month.totalWords }}</div>
    </div>
  </div>
</template>
```

### 5.3 新增 MultiYearView.vue 组件

```vue
<template>
  <div class="multi-year-view">
    <div class="year-selector">
      <select v-model="selectedYearCount">
        <option :value="3">最近3年</option>
        <option :value="5">最近5年</option>
        <option :value="0">全部</option>
      </select>
    </div>
    <div
      v-for="yearStats in displayedYears"
      :key="yearStats.year"
      class="year-section"
    >
      <div class="year-header" @click="toggleYear(yearStats.year)">
        <span class="toggle-icon">{{ isExpanded(yearStats.year) ? '▼' : '▶' }}</span>
        <span class="year-label">{{ yearStats.year }}年</span>
        <span class="year-total">总计: {{ yearStats.totalWords }} 词</span>
      </div>
      <div v-if="isExpanded(yearStats.year)" class="year-heatmap">
        <!-- 简化版热力图 -->
      </div>
    </div>
  </div>
</template>
```

---

## 6. 样式规范

### 6.1 月份卡片样式

```scss
.month-card {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.current-month {
    border-color: var(--interactive-accent);
    border-width: 2px;
  }

  // 根据学习量的背景色等级
  &.level-0 { background: var(--background-secondary); }
  &.level-1 { background: #9be9a8; }
  &.level-2 { background: #40c463; }
  &.level-3 { background: #30a14e; }
  &.level-4 { background: #216e39; }
}

.month-name {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.month-count {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-normal);
}
```

### 6.2 深色主题适配

```scss
.theme-dark {
  .month-card {
    &.level-0 { background: #2d333b; }
    &.level-1 { background: #0e4429; }
    &.level-2 { background: #006d32; }
    &.level-3 { background: #26a641; }
    &.level-4 { background: #39d353; }
  }
}
```

---

## 7. 性能考虑

1. **数据缓存**: 月份统计数据可缓存，避免重复查询
2. **懒加载**: 多年视图默认只加载最近3年，展开时才加载详情
3. **虚拟滚动**: 如果多年数据过多，考虑虚拟滚动

---

## 8. 测试计划

### 8.1 功能测试
- [ ] 月份网格显示正确，数据准确
- [ ] 点击月份跳转到正确位置
- [ ] 多年对比显示正确，年份顺序正确
- [ ] 视图切换正常，状态保持

### 8.2 边界测试
- [ ] 空数据（无学习记录的年份）
- [ ] 单个月份数据
- [ ] 跨年份数据

### 8.3 UI测试
- [ ] 深色主题适配
- [ ] 不同屏幕尺寸响应式

---

## 9. 实现任务分解

1. 更新数据接口 (`src/db/interface.ts`)
2. 实现数据库方法 (`src/db/local_db.ts`, `src/db/web_db.ts`, `src/db/json_sync_db.ts`)
3. 更新基类 (`src/db/base.ts`)
4. 创建 MonthGrid.vue 组件
5. 创建 MultiYearView.vue 组件
6. 修改 HeatmapPanel.vue 整合新视图
7. 添加多语言翻译
8. 构建测试验证

---

## 10. 依赖关系

- 依赖现有 `getHeatmapData` 方法
- 依赖 `createdDate` 字段（已实现）
- 复用现有热力图颜色等级逻辑

---

**下一步**: 使用 `superpowers:writing-plans` 创建详细实施计划。
