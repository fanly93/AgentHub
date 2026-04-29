---
description: 把三法衣原则写入项目宪法，让 Spec-kit 所有后续命令自动对齐业务/视觉/设计三套规范
allowed-tools: Read, Write, Bash
---

这个命令是"宪法级"操作，不是工具级。它会永久修改项目的 `.specify/memory/constitution.md`，
让后续所有 `/speckit-plan`、`/speckit-implement` 都自动遵守三法衣原则。

**执行前请确认：你在这个项目的根目录下。**

---

## 第 1 步：检查 Spec-kit 是否已初始化

用 Bash 工具依次执行：

```bash
# 检查 .specify/ 目录
ls .specify/ 2>/dev/null || echo "MISSING_SPECIFY_DIR"

# 检查 constitution.md
ls .specify/memory/constitution.md 2>/dev/null || echo "MISSING_CONSTITUTION"
```

根据结果判断：

- `.specify/` 目录不存在 → 停止执行，告诉用户：
  > `.specify/` 目录不存在，请先运行 `/speckit-constitution` 初始化 Spec-kit，再来执行这个命令。

- `.specify/memory/constitution.md` 不存在 → 停止执行，告诉用户：
  > `constitution.md` 还没有创建，请先运行 `/speckit-constitution` 生成项目宪法，再来追加三法衣。

- 两个都存在 → 继续执行第 2 步。

---

## 第 2 步：备份 + 追加三法衣

### 2-1 备份（必须在追加前完成）

用 Bash 工具执行：

```bash
cp .specify/memory/constitution.md .specify/memory/constitution.backup.md
echo "备份完成 → .specify/memory/constitution.backup.md"
```

备份成功后告诉用户：
> 已备份到 `.specify/memory/constitution.backup.md`。如需回滚，运行：
> `cp .specify/memory/constitution.backup.md .specify/memory/constitution.md`

### 2-2 读取现有内容

用 Read 工具读取 `.specify/memory/constitution.md` 的完整内容，记住原始内容。

### 2-3 追加三法衣

用 Write 工具把以下内容**追加**到 `.specify/memory/constitution.md` 末尾
（原始内容保持不变，三法衣写在原始内容后面）。

---

追加的内容如下（完整文案，一字不改）：

```markdown

---

## 三法衣原则
<!-- 由 /spec-kit-patch 自动写入，请勿手动删除 -->
<!-- 回滚命令：cp .specify/memory/constitution.backup.md .specify/memory/constitution.md -->

### 第一法衣 — Spec-Kit 业务法衣

**所有功能开发必须严格遵守以下流程，不得跳步：**

1. **Spec first（规格先行）**：任何新功能，必须先运行 `/speckit-specify` 写出 spec，
   包含 User Story、Acceptance Criteria、Constraints 三个部分，缺一不可。

2. **完整流水线**：`spec → plan → tasks → implement`，四步缺一不可。
   禁止在 spec 未完成时开始 plan；禁止在 plan 未完成时生成 tasks；
   禁止在 tasks 未生成时开始 implement。

3. **Acceptance Criteria 是验收唯一标准**：每次 implement 结束，
   必须对照 spec 里的 Acceptance Criteria 逐条验收，未通过不得合并。

**违反本法衣的 PR/实现视为无效，必须回到对应阶段补齐文档。**

---

### 第二法衣 — StyleSeed 视觉法衣

**完整 69 条规则见 `.styleseed/rules.md`，以下为 4 条不可逾越的红线：**

1. **颜色必须用 Tailwind `@theme` 变量**：禁止在任何组件里写 hardcoded hex（如 `#3B82F6`）、
   禁止用裸 Tailwind 色阶（如 `bg-blue-500`）。必须用语义变量（如 `bg-primary`、`text-foreground`）。

2. **间距必须走 4px 阶梯**：禁止使用非 4 倍数的间距值（如 `p-[10px]`、`gap-[22px]`、`mt-[15px]`）。
   合法值：4、8、12、16、20、24、32、40、48、64……

3. **交互组件必须支持完整 5 态**：`default / hover / active / focus / disabled`，
   缺少任意一态的组件不允许合并进主分支。

4. **图标必须用 `lucide-react`**：禁止用 emoji 作为功能性图标（loading、error、success、action 等场景）。
   emoji 只允许在纯展示/装饰性文案里出现。

> 完整 StyleSeed 规则（共 69 条）：`.styleseed/rules.md`
> 每次 `/speckit-implement` 执行前，自动对照完整规则做视觉合规检查。

---

### 第三法衣 — Figma Variables 设计法衣

**设计稿与代码的变量系统必须保持一一对应，不允许两套各自为政：**

1. **设计稿必须 Variables 化**：所有颜色、间距、圆角、阴影必须定义为 Figma Variables，
   分层命名空间：`bg / fg / border / primary / surface / overlay`，
   不允许在设计稿里使用未定义为变量的本地样式。

2. **命名必须语义化，禁止值语义**：
   - ❌ 禁止：`color/blue500`、`spacing/16`、`radius/4`
   - ✅ 正确：`color/primary/default`、`spacing/component/gap`、`radius/card`
   命名传达"用途"，不传达"数值"，方便日后主题切换不改名字。

3. **Figma Variables 与 Tailwind `@theme` 保持一一对应**：
   每次更新 Figma Variables，必须同步更新 `globals.css` 里的 `@theme` 块；
   反之亦然。两侧变量名必须一致，不允许 Figma 叫 `primary/default`、代码叫 `--primary`。
   发现不一致，优先以 Figma Variables 为准（设计是真相来源）。

**Version**: 1.0.0 | **Patched**: <!-- 执行时替换为今天的日期，格式 YYYY-MM-DD -->
```

---

## 第 3 步：生成验证报告

追加完成后：

1. 用 Read 工具**重新读取** `.specify/memory/constitution.md`，确认三法衣内容已写入。

2. 生成以下格式的验证报告展示给用户：

---

**三法衣生效清单**

| 法衣 | 写入状态 | 核心约束 |
|------|---------|---------|
| 第一法衣 — Spec-Kit 业务法衣 | ✅ 已写入 | spec→plan→tasks→implement 四步缺一不可 |
| 第二法衣 — StyleSeed 视觉法衣 | ✅ 已写入 | 4 条红线 + 引用 `.styleseed/rules.md` |
| 第三法衣 — Figma Variables 设计法衣 | ✅ 已写入 | Figma Variables ↔ Tailwind @theme 一一对应 |

**从现在开始，后续 `/speckit-plan` 和 `/speckit-implement` 都会自动对齐这 3 法衣。**

3. 最后附上回滚命令，以防万一：

> 如需撤销本次修改，运行：
> ```bash
> cp .specify/memory/constitution.backup.md .specify/memory/constitution.md
> ```
