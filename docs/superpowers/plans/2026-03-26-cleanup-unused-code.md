# 清理未使用代码实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理项目中未使用的代码，保持代码库整洁，同时不影响现有功能

**架构：** 保守清理策略 - 只删除确认完全未使用且不影响现有功能的代码，保留被注释但可能未来启用的功能

**技术栈：** TypeScript, Obsidian Plugin API

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/settings.ts` | 修改 | 删除 `backendSettings` 方法 |
| `src/db/markdown_db.ts` | 删除 | 未使用的 Markdown 数据库类 |
| `src/constant.ts` | 修改 | 删除未使用的 `dict.NAME` 常量 |

---

## Task 1: 删除 `backendSettings` 方法

**文件：**
- 修改: `src/settings.ts:326-419`

**背景：** `backendSettings` 方法是遗留的服务器后端设置方法，从未在 `display()` 中被调用，已被新的 `storageSettings` 方法替代。

**验证方法：**
```bash
grep -n "backendSettings" src/settings.ts
# 应该只显示方法定义本身，没有调用处
```

- [ ] **Step 1: 删除 `backendSettings` 方法**

删除第 326-419 行的整个方法：

```typescript
// 删除整个方法
backendSettings(containerEl: HTMLElement) {
    // ... 方法内容 ...
}
```

- [ ] **Step 2: 验证删除后构建正常**

```bash
npm run build
# Expected: 构建成功，无错误
```

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "refactor: remove unused backendSettings method"
```

---

## Task 2: 删除 `MarkdownDb` 类文件

**文件：**
- 删除: `src/db/markdown_db.ts`

**背景：** `MarkdownDb` 是完整的 Markdown 数据库实现类，但没有任何文件导入使用它。数据已迁移到 JSON 格式。

**验证方法：**
```bash
grep -r "MarkdownDb" src/
# 应该只显示文件本身，没有导入

grep -r "from.*markdown_db" src/
# 应该没有结果
```

- [ ] **Step 1: 删除文件**

```bash
rm src/db/markdown_db.ts
```

- [ ] **Step 2: 验证删除后构建正常**

```bash
npm run build
# Expected: 构建成功，无错误
```

- [ ] **Step 3: Commit**

```bash
git add src/db/markdown_db.ts
git commit -m "refactor: remove unused MarkdownDb class"
```

---

## Task 3: 删除未使用的 `dict.NAME` 常量

**文件：**
- 修改: `src/constant.ts:1-7`

**背景：** `dict.NAME` 常量定义了但未在任何地方使用。

**验证方法：**
```bash
grep -r "dict\.NAME" src/
# 应该只显示定义本身

grep -r "NAME.*Language" src/
# 应该只显示定义本身
```

- [ ] **Step 1: 删除未使用的常量**

修改 `src/constant.ts`：

```typescript
// 删除以下代码
const dict = {
    NAME: "Language Learner"
};

// 删除导出
export { dict };
```

只保留：
```typescript
import { t } from "./lang/helper";

// 鼠标位置（用于弹窗定位）
type Position = {
    x: number;
    y: number;
};

// ... 其余代码保持不变
```

- [ ] **Step 2: 验证删除后构建正常**

```bash
npm run build
# Expected: 构建成功，无错误
```

- [ ] **Step 3: Commit**

```bash
git add src/constant.ts
git commit -m "refactor: remove unused dict.NAME constant"
```

---

## Task 4: 最终验证

- [ ] **Step 1: 完整构建验证**

```bash
npm run build
# Expected:
# main.js   xxx kb
# main.css  xxx kb
# ⚡ Done
```

- [ ] **Step 2: 检查未使用导入**

```bash
# 检查 settings.ts 中是否还有未使用的导入
grep -n "WebDb" src/settings.ts
# 应该只在 storageSettings 中使用

grep -n "LocalDb" src/settings.ts
# 应该只在 indexedDBSettings 中使用
```

- [ ] **Step 3: 最终 Commit（可选，合并为一个）**

如果之前已经分别 commit，可以跳过此步骤。或者：

```bash
git log --oneline -5
# 确认提交历史
```

---

## 注意事项

### 保留的代码（不删除）

以下代码虽然被注释或未完全使用，但可能未来启用，**不删除**：

1. **`StatView` 统计视图** (`src/views/StatView.ts`)
   - 代码被注释但功能完整
   - 可能未来重新启用统计功能

2. **`PDFView` PDF 阅读视图** (`src/views/PDFView.ts`)
   - 代码被注释但功能完整
   - 可能未来重新启用 PDF 功能

3. **`use_server` 设置字段**
   - 虽然在 `indexedDBSettings` 中检查，但可能影响用户旧设置
   - 保留以确保向后兼容

### 清理后检查清单

- [ ] 构建成功无错误
- [ ] 构建产物大小没有异常增加
- [ ] 没有引入新的 TypeScript 警告
- [ ] 插件基本功能正常（手动测试）
