# Legal Work Space

律师工作台 —— 一个界面完成所有工作，操作极简。

纯前端本地应用：React + TypeScript + Tailwind CSS + Dexie.js（IndexedDB），数据完全保存在本地浏览器存储，隐私优先，不上传任何服务器。支持浏览器使用，也可打包为 macOS / Windows / Linux 桌面应用（Electron）。

## 功能模块

- **首页仪表盘**：期限预警横幅、数字卡片、今日待办、案件阶段分布、快捷入口
- **案件管理**：卡片列表 + 阶段进度条 + 时间线 + 文档区 + 关键日期 + 工时费用 + 待办
- **客户管理**：客户档案 + 沟通记录 + 利益冲突模糊检索
- **常法客户**：服务进度条 + 工作记录 / 合同费用 / 统计概览 + 年度顾问报告自动生成
- **文档与模板**：文档库 + 8 类内置文书模板 + 富文本编辑器 + 变量自动填充 + 导出 Word/PDF
- **日历日程**：月/周/列表视图 + 期限自动计算（举证 +30 天、上诉 +15 天）
- **计时与计费**：全局计时器 + 工时记录 + A4 账单预览 + 收入看板
- **保全提醒**：五级到期预警 + 汇总页 + 弹窗强制提醒 + 续期管理 + 风险报告
- **设置**：律师信息 / 费率 / 数据导入导出（JSON 备份）

## 开发

```bash
npm install       # 安装依赖
npm run dev       # 浏览器开发模式（http://localhost:5173）
npm run build     # 生产构建（dist/）
npm run preview   # 预览生产构建
```

## 桌面端

```bash
npm run desktop    # 构建并以 Electron 桌面窗口运行
npm run dist:mac   # 打包 macOS（dmg + zip，产物在 release/）
npm run dist:win   # 打包 Windows（nsis）
npm run dist:linux # 打包 Linux（AppImage）
```

## 技术栈

- [Vite](https://vitejs.dev/) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)（白色系语义化配色）
- [Dexie.js](https://dexiejs.com/)（IndexedDB 封装，数据本地持久化）
- [date-fns](https://date-fns.org/) 日期处理
- [Phosphor Icons](https://phosphoricons.com/) 图标
- [Electron](https://www.electronjs.org/) 桌面封装

## 隐私说明

所有数据（案件、客户、文档、日程、工时等）存储在浏览器本地 IndexedDB 中，不上传任何服务器。数据备份请使用「设置 → 数据管理 → 导出全部数据」。
