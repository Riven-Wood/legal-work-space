# DEVELOPMENT_GUIDE.md — 律师工作台开发指南

> 本文档面向接力开发的 Agent，帮助你快速理解代码约定和开发模式。

---

## 1. 环境准备

```bash
cd lawyer-workbench
npm install     # 安装依赖
npm run dev     # 启动开发服务器 → http://localhost:5173
```

Node.js >= 18，推荐 20+（CI 使用 20）。

---

## 2. 编码规范

### 2.1 文件组织

- 页面组件放 `src/pages/{module}/`，文件名 PascalCase
- 通用组件放 `src/components/{category}/`
- 类型定义集中在 `src/types/index.ts`
- 工具函数放 `src/utils/`
- 不要创建 `src/lib/`、`src/helpers/` 等额外目录

### 2.2 组件风格

- 函数组件 + Hooks，不使用 class component
- 默认导出页面组件（`export default function Dashboard()`）
- 命名导出通用组件（`export function Modal()`）
- 组件内不写内联 `<style>`，所有样式通过 Tailwind 类名
- 复杂页面拆分为内部子组件（同文件内 function 声明）

### 2.3 数据查询

统一使用 `dexie-react-hooks` 的 `useLiveQuery`：

```typescript
const cases = useLiveQuery(
  () => db.cases.where('deleted').equals(0).toArray(),
  []
) as LawCase[] | undefined
```

- 返回 `undefined`（加载中）或数组
- 查询条件变化时传入依赖数组
- **必须** 过滤 `deleted` 字段
- 列表渲染时用 `?? []` 兜底空数组

### 2.4 数据写入

```typescript
// 创建
await db.cases.add({
  name: '...',
  status: 'active',
  stage: '接案',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  // deleted 字段由 hook 自动补 0
})

// 更新
await db.cases.update(id, { ...changes, updatedAt: Date.now() })

// 软删除
await db.cases.update(id, { deleted: Date.now(), updatedAt: Date.now() })
```

### 2.5 弹窗模式

使用 `<Modal>` 组件，配合 `useState` 控制开关：

```typescript
const [open, setOpen] = useState(false)

<Modal open={open} onClose={() => setOpen(false)} title="标题" width={520}
  footer={<>
    <button className="btn-ghost" onClick={() => setOpen(false)}>取消</button>
    <button className="btn-primary" onClick={save}>保存</button>
  </>}
>
  {/* 内容 */}
</Modal>
```

删除操作使用 `<ConfirmDialog>`：

```typescript
<ConfirmDialog open={!!target} title="删除" message="确定删除？" danger
  onCancel={() => setTarget(null)}
  onConfirm={() => { /* 软删除 */ setTarget(null) }}
/>
```

### 2.6 表单

使用 `Field` + `TextInput` / `TextArea` / `Select`：

```typescript
<Field label="案件名称" required hint="提示文字">
  <TextInput value={name} onChange={(e) => setName(e.target.value)} />
</Field>
```

- `TextInput` 已内置 `.input-base` 样式（聚焦边框变暖杏灰）
- `Select` 同理
- 日期用 `<TextInput type="date">`，值用 `fmtDateInput()` 格式化

### 2.7 导航

```typescript
const { navigate } = useApp()

// 进入详情
navigate({ page: 'cases', caseId: 123 })

// 返回列表
navigate({ page: 'cases' })

// 带参数跳转
navigate({ page: 'billing', billingTab: 'revenue' })
```

### 2.8 图标

使用 `@phosphor-icons/react`，regular 风格：

```typescript
import { Briefcase, PencilSimple, Trash } from '@phosphor-icons/react'

<Briefcase size={18} />
<PencilSimple size={13} className="text-text-muted" />
```

选中态用 `weight="fill"`。

---

## 3. 通用组件速查

| 组件 | 路径 | 用途 |
|---|---|---|
| `Modal` | components/ui/Modal.tsx | 弹窗（open/onClose/title/children/footer/width） |
| `ConfirmDialog` | components/ui/Modal.tsx | 确认对话框（open/title/message/danger/onConfirm/onCancel） |
| `Field` | components/ui/Field.tsx | 表单字段容器（label/required/hint） |
| `TextInput` | components/ui/Field.tsx | 文本输入（继承 input 属性） |
| `TextArea` | components/ui/Field.tsx | 多行文本 |
| `Select` | components/ui/Field.tsx | 下拉选择 |
| `Tag` | components/ui/Tag.tsx | 标签（color: primary/accent/danger/warm/muted/success/outline） |
| `Dot` | components/ui/Tag.tsx | 圆点（color/size） |
| `EmptyState` | components/ui/EmptyState.tsx | 空状态（icon/title/action） |
| `DocPreview` | components/ui/DocPreview.tsx | 文档预览（PDF/图片） |
| `CaseDocs` | components/case/CaseDocs.tsx | 案件文档区（分区+版本管理） |
| `PreservationCard` | components/preservation/PreservationCard.tsx | 保全信息卡片 |
| `PreservationAlert` | components/preservation/PreservationAlert.tsx | 保全弹窗强制提醒 |

---

## 4. 工具函数速查

### dates.ts

| 函数 | 说明 |
|---|---|
| `todayStamp()` | 今天 0 点时间戳 |
| `fmtDate(ts, pattern?)` | 格式化日期，默认 `yyyy.MM.dd` |
| `fmtDateTime(ts)` | 格式化日期时间 `yyyy.MM.dd HH:mm` |
| `fmtDateInput(ts?)` | 本地时区 `yyyy-MM-dd`（用于 `<input type="date">`） |
| `fmtMoney(n)` | 金额 `¥1,234.00` |
| `fmtHours(minutes)` | 工时 `1.5h` |
| `fmtDuration(seconds)` | 计时 `01:23:45` |
| `daysUntil(ts)` | 距今天数（正=未来，0=今天，负=过期） |
| `countdownLabel(ts)` | 倒计时文本+级别 |

### format.ts

| 函数 | 说明 |
|---|---|
| `formatBytes(bytes)` | `1.5 MB` |
| `downloadBlob(data, filename)` | 下载 Blob |
| `similarity(a, b)` | 中文模糊匹配相似度（0-1） |
| `CAUSES` | 民商事常见案由列表 |
| `CONFLICT_HINT` | 利益冲突提示文案 |
| `uid()` | 简单唯一 ID |

---

## 5. 常见陷阱

### 5.1 导航残留 ID

`navigate()` 会清除未显式传入的详情参数。如果跳转时需要保留 caseId，必须显式传入：

```typescript
// ❌ 错误：caseId 会被清除
navigate({ page: 'billing' })

// ✅ 正确：显式传 caseId
navigate({ page: 'billing', caseId: currentCaseId })
```

### 5.2 useLiveQuery 返回 undefined

首次渲染时 `useLiveQuery` 返回 `undefined`，需要兜底：

```typescript
const cases = useLiveQuery(...) as LawCase[] | undefined

// ❌ 会报错
cases.map(...)

// ✅ 正确
(cases ?? []).map(...)

// 或者
const list = cases ?? []
list.map(...)
```

### 5.3 软删除查询

所有查询必须过滤 `deleted`：

```typescript
// ❌ 会返回已删除的数据
db.cases.toArray()

// ✅ 正确
db.cases.where('deleted').equals(0).toArray()
```

### 5.4 DB 版本迁移

新增字段或新表时，必须升级 Dexie schema 版本：

```typescript
// 在 database.ts 中添加新版本
this.version(6).stores({
  // 必须列出所有表（即使不变），只改变化的表
  cases: '++id, clientId, status, stage, cause, newField, createdAt, updatedAt, deleted',
  // ... 其他表照抄
})
```

### 5.5 Electron 路径

`vite.config.ts` 中 `base: './'` 是必须的，否则 Electron `file://` 协议无法加载资源。

### 5.6 文件上传

文件内容存为 `Blob` 在 IndexedDB 中。大文件可能影响性能，但目前的设计是全本地存储。

---

## 6. 添加新功能 Checklist

- [ ] 在 `src/types/index.ts` 中定义类型（继承 BaseEntity）
- [ ] 在 `src/db/database.ts` 中添加表 + 升级 schema 版本
- [ ] 创建页面组件 `src/pages/{module}/`
- [ ] 在 `AppContext.tsx` 的 `PageKey` 中添加页面 key
- [ ] 在 `Sidebar.tsx` 的 `MENU` 中添加菜单项
- [ ] 在 `App.tsx` 的 `Router` switch 中添加 case
- [ ] 在 `GlobalSearch.tsx` 中添加搜索分组（如需要）
- [ ] 在 `SettingsPage.tsx` 的导出/导入/清空表名列表中添加新表名
- [ ] 测试：`npx tsc --noEmit` + `npm run dev`
