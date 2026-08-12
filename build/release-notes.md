# Legal Work Space v1.1.0

Legal Work Space 是一款面向独立执业律师的本地优先工作台，案件、客户、文档、日程和费用数据均保存在用户本地。

## 本版更新

- **应用内更新**：软件启动时自动检查新版本，发现更新可在软件内一键下载安装包（设置页也可手动「检查更新」），无需再到 GitHub 手动查找下载
- **客户管理增强**：客户详情支持直接编辑客户信息；支持删除客户（二次确认，删除后关联的案件、沟通记录、文档等业务数据仍保留）

## 主要功能

- 案件、客户和常年法律顾问管理
- 文档上传、预览、分区和版本历史
- 月/周/列表日历及常用法律期限计算
- 法律咨询计时与咨询记录
- 发票、收据、转账凭证管理与收入看板
- 保全到期预警、续期管理和日历联动
- JSON 全量数据导出与导入

## 下载选择

- Apple 芯片 Mac：`Legal-Work-Space-1.1.0-mac-arm64.dmg`
- Intel Mac：`Legal-Work-Space-1.1.0-mac-x64.dmg`
- Windows 10/11 x64：`Legal-Work-Space-1.1.0-win-x64.exe`
- Linux x64：`Legal-Work-Space-1.1.0-linux-x64.AppImage`

## 安装方法

### macOS

当前 macOS 安装包未使用 Apple Developer ID 签名与公证，从浏览器下载后首次打开时系统可能提示「已损坏」或「无法打开」。这是 macOS Gatekeeper 对未签名应用的默认拦截行为，安装包本身没有损坏。请按以下任一方法处理：

**方法一（推荐）：在终端中移除隔离属性**

下载 `.dmg` 后，在终端执行（请将路径替换为你实际下载的文件路径）：

```bash
xattr -d com.apple.quarantine ~/Downloads/Legal-Work-Space-1.1.0-mac-arm64.dmg
```

然后正常双击打开 DMG，将「Legal Work Space」拖入「应用程序」即可。

**方法二：右键打开**

1. 在 Finder 中双击 DMG 挂载后，把 `Legal Work Space.app` 拖入「应用程序」。
2. 在「应用程序」中找到 `Legal Work Space`，按住 Control 点击（或右键），选择「打开」。
3. 弹出的安全提示框中选择「打开」即可，之后不会再出现该提示。

### Windows

运行 `.exe` 安装包。首次安装可能出现 SmartScreen 提示，点击「更多信息 → 仍要运行」即可继续。

### Linux

赋予 AppImage 执行权限后运行：

```bash
chmod +x Legal-Work-Space-1.1.0-linux-x64.AppImage
./Legal-Work-Space-1.1.0-linux-x64.AppImage
```

如系统缺少 FUSE，可先安装 FUSE 2 兼容包，或使用 `--appimage-extract-and-run` 参数启动。

覆盖安装不会丢失数据；升级前如需保险可先在「设置 → 数据管理」导出全部数据。
