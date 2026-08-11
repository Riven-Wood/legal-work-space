# AGENT_HANDOFF.md — 律师工作台交接文档

> **最后更新**: 2026-08-09
> **版本**: v1.1.0
> **Git**: `main` 分支, tag `v1.1.0`, 已推送到 GitHub (Riven-Wood/legal-work-space)

---

## 一、项目概况

**Legal Work Space（律师工作台）**—— 独立执业律师的个人工作台，纯前端本地应用。

- **定位**: 民商事诉讼律师的日常办案工具，一个界面完成所有工作
- **数据**: 100% 本地 IndexedDB，隐私优先，不上传任何服务器
- **形态**: 支持浏览器使用 + Electron 桌面应用（macOS / Windows / Linux）
- **CI/CD**: GitHub Actions，打 tag 自动构建三平台安装包并发布 Release

### 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 构建 | Vite | ^5.4.11 |
| 框架 | React | ^18.3.1 |
| 语言 | TypeScript | ~5.6.3 |
| 样式 | Tailwind CSS | ^3.4.15 |
| 数据 | Dexie.js (IndexedDB) | ^4.0.10 |
| 数据绑定 | dexie-react-hooks | ^1.1.7 |
| 日期 | date-fns | ^3.6.0 |
| 图标 | @phosphor-icons/react | ^2.1.7 |
| 桌面 | Electron | ^33.2.0 |
| 打包 | electron-builder | ^25.1.8 |

> **注意**: `react-router-dom` 已安装但未使用，导航采用自定义状态路由。

---

## 二、文件结构

```
lawyer-workbench/
├── src/
│   ├── App.tsx                      # 应用入口 + 路由（状态路由，非 react-router）
│   ├── main.tsx                     # React DOM 挂载
│   ├── index.css                    # 全局样式 + Tailwind 组件类
│   ├── vite-env.d.ts
│   │
│   ├── types/
│   │   └── index.ts                 # 全部 TypeScript 类型定义（18 个实体接口）
│   │
│   ├── db/
│   │   └── database.ts             # Dexie 数据库定义（v5，5 次迁移）+ 通用 helper
│   │
│   ├── store/
│   │   └── AppContext.tsx           # 全局状态：导航 + 计时器 + 搜索 + 刷新
│   │
│   ├── utils/
│   │   ├── dates.ts                 # 日期格式化、倒计时、工具函数
│   │   └── format.ts                # 文件大小、金额、下载、相似度匹配、案由列表
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # 左侧导航栏（可折叠）
│   │   │   ├── TopBar.tsx           # 顶部搜索栏
│   │   │   └── GlobalSearch.tsx     # Cmd+K 全局搜索（案件/客户/常法/文档/工作记录）
│   │   ├── ui/
│   │   │   ├── Modal.tsx            # 弹窗 + 确认对话框
│   │   │   ├── Field.tsx            # 表单字段组件（Field/TextInput/TextArea/Select）
│   │   │   ├── Tag.tsx              # 标签 + 圆点
│   │   │   ├── EmptyState.tsx       # 空状态占位
│   │   │   └── DocPreview.tsx      # 文档预览（PDF/图片）
│   │   ├── case/
│   │   │   └── CaseDocs.tsx         # 案件文档区（分区 + 版本管理）
│   │   └── preservation/
│   │       ├── PreservationCard.tsx  # 保全信息卡片
│   │       └── PreservationAlert.tsx # 保全弹窗强制提醒
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx            # 首页仪表盘
│   │   ├── cases/
│   │   │   ├── CaseList.tsx         # 案件列表
│   │   │   ├── CaseDetail.tsx       # 案件详情（三栏布局）
│   │   │   └── CaseForm.tsx         # 新建/编辑案件
│   │   ├── clients/
│   │   │   └── ClientList.tsx       # 客户列表 + 详情 + 利益冲突检索
│   │   ├── retainers/
│   │   │   ├── RetainerList.tsx     # 常法客户列表
│   │   │   └── RetainerDetail.tsx   # 常法客户详情（三标签页）
│   │   ├── docs/
│   │   │   └── DocsPage.tsx         # 文档库（上传/预览/版本/分区）
│   │   ├── calendar/
│   │   │   └── CalendarPage.tsx     # 日历视图（月/周/列表）
│   │   ├── consultation/
│   │   │   └── ConsultationPage.tsx # 法律咨询（计时器 + 记录管理）
│   │   ├── billing/
│   │   │   └── BillingPage.tsx      # 账单管理（发票材料 + 收入看板）
│   │   ├── preservation/
│   │   │   └── PreservationCenter.tsx # 保全预警汇总
│   │   └── settings/
│   │       └── SettingsPage.tsx     # 设置（律师信息/数据管理/关于）
│   │
│   └── assets/
│       └── logo.png                 # 应用 Logo
│
├── electron/
│   └── main.cjs                     # Electron 主进程
│
├── .github/
│   └── workflows/
│       └── build.yml                # CI/CD（tag 触发，三平台构建）
│
├── build/                           # Electron 打包图标
├── public/                          # 静态资源
├── dist/                            # Vite 构建产物
├── release/                         # Electron 打包产物
│
├── index.html                       # HTML 入口
├── vite.config.ts                   # Vite 配置
├── tailwind.config.js               # Tailwind 配置（语义化颜色别名）
├── postcss.config.js
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## 三、核心架构

### 3.1 路由（状态路由，非 react-router）

导航通过 `AppContext` 的 `nav` 状态驱动，`App.tsx` 中 `switch(nav.page)` 渲染对应页面。

```typescript
// store/AppContext.tsx
type PageKey = 'dashboard' | 'cases' | 'clients' | 'retainers' | 'docs'
             | 'calendar' | 'billing' | 'consultation' | 'preservation' | 'settings'

interface NavState {
  page: PageKey
  caseId?: number       // 案件详情
  clientId?: number     // 客户详情
  retainerId?: number   // 常法详情
  billingTab?: 'invoice' | 'revenue'
}

// 页面跳转
navigate({ page: 'cases', caseId: 123 })
// 返回列表（不传 caseId 即可）
navigate({ page: 'cases' })
```

**注意**: `navigate` 会清除未显式传入的详情参数，避免残留 ID 导致无法返回列表。

### 3.2 数据层（Dexie.js）

- 数据库: `lawyer-workbench` (IndexedDB)
- 当前版本: **v5**（5 次迁移）
- 软删除: 所有表有 `deleted` 字段（时间戳，0 = 未删除）
- 查询: `useLiveQuery(() => db.xxx.where('deleted').equals(0).toArray(), [])`
- 创建钩子: 自动给新记录补 `deleted = 0`

**18 张表**:

| 表名 | 实体 | 说明 |
|---|---|---|
| `cases` | LawCase | 案件 |
| `clients` | Client | 客户 |
| `docs` | DocFile | 文档（支持版本组 versionGroup） |
| `docFolders` | DocFolder | 案件文档分区 |
| `events` | CalendarEvent | 日历事件 |
| `timeRecords` | TimeRecord | 工时记录（旧版，计时器已改为 LegalConsultation） |
| `invoices` | Invoice | 账单（旧版，计费已改为 InvoiceFile） |
| `retainers` | Retainer | 常法客户 |
| `retainerWorks` | RetainerWork | 常法工作记录 |
| `retainerPayments` | RetainerPayment | 常法付款记录 |
| `retainerReports` | RetainerReport | 常法顾问报告 |
| `preservations` | Preservation | 保全记录 |
| `preservationRenewals` | PreservationRenewal | 保全续期记录 |
| `legalConsultations` | LegalConsultation | 法律咨询记录（v4 新增） |
| `invoiceFiles` | InvoiceFile | 发票/票据材料（v5 新增） |
| `settings` | Settings | 设置（单行） |
| `todos` | Todo | 待办 |
| `timelines` | CaseTimeline | 案件时间线 |
| `contactRecords` | ContactRecord | 客户沟通记录 |

### 3.3 全局状态（AppContext）

| 状态 | 用途 |
|---|---|
| `nav` | 当前页面 + 详情 ID |
| `timer` | 法律咨询计时器（running/accumulated/lastTick） |
| `runningSeconds` | 计时器实时秒数（每秒刷新） |
| `searchOpen` | 全局搜索面板开关 |
| `refreshKey` | 数据刷新触发器（bumpRefresh 手动触发） |

### 3.4 样式系统

**Tailwind 语义化颜色** (tailwind.config.js):

```
primary:        #4b5563   (灰蓝，按钮/导航)
primary-light:  #9aa3ad   (浅灰蓝，次要元素)
accent:         #b09878   (暖杏灰，高亮/选中/金额)
danger:         #c4816b   (陶粉，警告/删除)
bg-page:        #f4f3f1   (页面背景)
bg-warm:        #ebe9e4   (暖灰白，面板/表头)
bg-card:        #ffffff   (纯白，卡片)
text-main:       #2e2e2e   (炭灰，正文)
text-muted:      #8d8d8d   (板石灰，次要文字)
border:         #e5e3de   (灰米，边框)
success:        #7a9a7e   (鼠尾草灰绿，成功/已完成)
```

**CSS 组件类** (index.css @layer components):

```
.btn .btn-primary .btn-ghost .btn-danger .btn-accent .btn-sm
.input-base
.card .card-pad
.chip
.th .td .tr-hover
```

---

## 四、功能实现状态

### 已实现（完整或基本完整）

| 步骤 | 模块 | 状态 | 说明 |
|---|---|---|---|
| 1 | 项目骨架 | ✅ | 布局、导航、全局搜索、数据存储 |
| 2 | 案件管理 | ✅ | 列表、详情（阶段进度条/时间线/文档区/关键日期/待办）、新建/编辑 |
| 3 | 客户管理 | ✅ | 列表、详情抽屉、利益冲突模糊检索 |
| 5 | 日历日程 | ✅ | 月/周/列表视图、期限自动计算 |
| 7 | 常法客户 | ✅ | 列表、详情（工作记录/合同费用/统计概览）、年度顾问报告生成 |
| 8 | 保全提醒 | ✅ | 五级预警、汇总页、弹窗强制提醒、续期管理、日历联动 |
| 9 | 首页仪表盘 | ✅ | 预警横幅、数字卡片、今日待办、案件概览、快捷入口 |
| 11 | 设置 | ✅ | 律师信息、数据导入导出、清空数据 |

### 已实现但有偏差

| 步骤 | 模块 | 偏差说明 |
|---|---|---|
| 4 | 文档与模板 | ⚠️ 文档库完整（上传/预览/版本/分区），但**模板中心、富文本编辑器、变量自动填充未实现**。templates 表在 v2 迁移中移除。旧版 HTML 草稿有兜底的 Word 导出。 |
| 6 | 计时与计费 | ⚠️ 计时器从全局顶栏移至**法律咨询模块**（ConsultationPage），记录为 LegalConsultation 而非 TimeRecord。计费从**自动生成 A4 账单**改为**用户自行上传发票/票据材料**（InvoiceFile 表），收入看板基于上传的发票金额。原 TimeRecord 和 Invoice 表仍保留但未使用。 |

### 未实现

| 步骤 | 模块 | 说明 |
|---|---|---|
| 10 | AI 助手 | ❌ 完全未实现。无悬浮按钮、无侧边面板、无文书起草/合同审查/法律检索功能。 |

### 设置页缺失字段

Settings 类型中有 `hourlyRate` 和 `includeRetainerHours` 字段，数据库默认值存在，但**设置页 UI 未渲染这两个字段的表单控件**。

---

## 五、与原始设计指令的偏差

原始指令文件: `律师工作台完整搭建指令.md`（工作区根目录）

### 5.1 配色方案

| 项目 | 原始指令 | 实际实现 |
|---|---|---|
| 主色 | #5b6e7a 雾灰蓝 | #4b5563 灰蓝 |
| 页面背景 | #f5f2ed 灰白垩 | #f4f3f1 浅暖灰白 |
| 卡片背景 | #fafaf8 暖白 | #ffffff 纯白 |
| 文字主色 | #3a3a3a 炭灰 | #2e2e2e 炭灰 |
| 侧边栏 | 雾灰蓝底白字 | 白底灰字（选中态暖杏灰左边框） |

> 实际配色比原始指令更简洁、更白色系。

### 5.2 计时器

- **原始**: 全局顶栏常驻胶囊按钮，关联案件
- **实际**: 移至法律咨询页面，关联客户/案件/咨询人，保存为 LegalConsultation

### 5.3 计费模块

- **原始**: 选案件→选日期→自动汇总工时→A4 账单预览→导出 PDF
- **实际**: 用户自行上传发票/收据/转账凭证，收入看板基于上传的发票金额统计

### 5.4 文档模板

- **原始**: 8 类模板（起诉状/答辩状/代理词/上诉状/律师函/法律意见书/财产保全申请书/证据目录）+ 富文本编辑器 + 变量自动填充 + 导出 Word/PDF
- **实际**: 仅文档库（文件上传/预览/下载/版本管理/分区），模板中心和编辑器完全未实现

---

## 六、开发指南

### 6.1 启动开发

```bash
cd lawyer-workbench
npm install        # 安装依赖
npm run dev        # 浏览器开发 → http://localhost:5173
npm run desktop    # Electron 桌面模式
```

### 6.2 构建

```bash
npm run build       # 生产构建 → dist/
npm run dist:mac    # macOS 打包 → release/
npm run dist:win    # Windows 打包
npm run dist:linux  # Linux 打包
```

### 6.3 TypeScript 检查

```bash
npx tsc --noEmit    # 当前无错误
```

### 6.4 添加新页面的步骤

1. 在 `src/pages/` 下创建组件
2. 在 `src/store/AppContext.tsx` 的 `PageKey` 类型中添加页面 key
3. 在 `src/components/layout/Sidebar.tsx` 的 `MENU` 数组中添加菜单项
4. 在 `src/App.tsx` 的 `Router` 函数的 `switch` 中添加 case
5. 如需在全局搜索中纳入，在 `GlobalSearch.tsx` 中添加搜索分组

### 6.5 数据操作模式

```typescript
// 读取（响应式）
const data = useLiveQuery(() => db.xxx.where('deleted').equals(0).toArray(), [])

// 创建
await db.xxx.add({ ...fields, createdAt: Date.now(), updatedAt: Date.now() })

// 更新
await db.xxx.update(id, { ...changes, updatedAt: Date.now() })

// 软删除
await db.xxx.update(id, { deleted: Date.now(), updatedAt: Date.now() })

// 批量软删除（版本组）
await db.xxx.where('versionGroup').equals(vg).modify({ deleted: Date.now(), updatedAt: Date.now() })
```

### 6.6 关键约定

- 所有实体继承 `BaseEntity`（id/createdAt/updatedAt/deleted）
- 软删除：设置 `deleted` 为时间戳，不真正删除
- 日期存储为时间戳（number），使用 `fmtDate()` / `fmtDateInput()` 格式化
- 金额格式化用 `fmtMoney()`，工时格式化用 `fmtHours()`
- 文件内容存为 Blob 在 IndexedDB 中
- 表单输入框聚焦时边框变暖杏灰（已在 `.input-base` 中定义）

---

## 七、待完成工作（供接力 Agent 参考）

### 优先级 P0 — 核心缺失功能

1. **AI 助手**（步骤 10）
   - 右下角悬浮按钮 → 侧边面板滑出
   - 智能起草文书 / 合同条款审查 / 法律检索
   - 对话式交互界面
   - AI 回复支持复制、插入文档

2. **模板中心 + 富文本编辑器**（步骤 4）
   - 8 类文书模板
   - 富文本编辑器（加粗/标题/列表/缩进/落款右对齐）
   - 变量自动填充：{委托人}/{对方当事人}/{受理法院}/{案由}/{当前日期}
   - 导出 Word / PDF
   - 草稿自动关联案件文档区

### 优先级 P1 — 完善现有功能

3. **设置页补全**
   - 添加"默认小时费率"表单控件
   - 添加"常法工时纳入计费统计"开关

4. **响应式适配**
   - 当前仅桌面端，手机端适配核心功能（案件列表/详情、日历、计时）

### 优先级 P2 — 优化

5. **数据迁移清理**
   - `timeRecords` 和 `invoices` 表已废弃，可考虑在未来迁移中清理
   - `templates` 表在 v2 迁移中已从 schema 移除（但旧数据可能残留）

6. **图表优化**
   - 常法统计概览的饼图/柱状图目前用 SVG 手绘，可考虑引入图表库

---

## 八、注意事项

1. **不要删除根目录的 `律师工作台完整搭建指令.md`** — 这是原始设计需求文档
2. **DB 迁移**: 新增字段必须升级 Dexie 版本号（当前 v5），旧用户数据需保留
3. **软删除**: 查询必须加 `.where('deleted').equals(0)` 过滤
4. **Electron**: `base: './'` in vite.config.ts 是为了兼容 Electron file:// 协议
5. **CI/CD**: 打 tag (`git tag v1.2.0 && git push origin v1.2.0`) 触发自动构建发布
6. **package-lock.json**: 根目录的 `package.json`（puppeteer-core）与项目无关，不要混淆
