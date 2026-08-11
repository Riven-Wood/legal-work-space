# Legal Work Space

律师工作台 —— 一个界面完成所有工作，操作极简。

纯前端本地应用：React + TypeScript + Tailwind CSS + Dexie.js（IndexedDB），数据完全保存在本地浏览器存储，隐私优先，不上传任何服务器。支持浏览器使用，也可打包为 macOS / Windows / Linux 桌面应用（Electron）。

## 下载与安装

请从 [GitHub Releases](https://github.com/Riven-Wood/legal-work-space/releases/latest) 下载最新版本。v1.0.0 安装包文件名如下：

| 平台 | 适用设备 | 下载文件 |
| --- | --- | --- |
| macOS | Apple 芯片（M1/M2/M3/M4 等） | `Legal-Work-Space-1.0.0-mac-arm64.dmg` |
| macOS | Intel 芯片 | `Legal-Work-Space-1.0.0-mac-x64.dmg` |
| Windows | 64 位 Windows 10/11 | `Legal-Work-Space-1.0.0-win-x64.exe` |
| Linux | 64 位 x86 Linux | `Legal-Work-Space-1.0.0-linux-x64.AppImage` |

- macOS：打开 DMG 后将应用拖入「应用程序」。当前安装包未使用 Apple Developer ID 签名；首次打开如被系统拦截，请在 Finder 中按住 Control 点击应用，选择「打开」。
- Windows：运行 `.exe` 安装包。当前安装包未进行商业代码签名，首次安装可能出现 SmartScreen 提示。
- Linux：赋予 AppImage 执行权限后运行：`chmod +x Legal-Work-Space-1.0.0-linux-x64.AppImage`。

升级前建议在「设置 → 数据管理」中导出全部数据。桌面端数据保存在当前系统用户的 Electron 应用数据目录中，覆盖安装新版本不会主动删除旧数据。

## 功能模块

- **首页仪表盘**：期限预警横幅、数字卡片、今日待办、案件阶段分布、快捷入口
- **案件管理**：卡片列表 + 阶段进度条 + 时间线 + 文档区 + 关键日期 + 工时费用 + 待办
- **客户管理**：客户档案 + 沟通记录 + 利益冲突模糊检索
- **常法客户**：服务进度条 + 工作记录 / 合同费用 / 统计概览 + 年度顾问报告自动生成
- **文档管理**：文档库 + 上传/预览/下载 + 文件分区 + 版本历史
- **日历日程**：月/周/列表视图 + 期限自动计算（举证 +30 天、上诉 +15 天）
- **法律咨询**：咨询计时 + 关联客户/案件 + 咨询记录
- **票据与收入**：发票/收据/转账凭证上传 + 收入看板
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
