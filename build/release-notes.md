# Legal Work Space v1.1.0

Legal Work Space 是一款面向独立执业律师的本地优先工作台，案件、客户、文档、日程和费用数据均保存在用户本地。

## macOS 用户：首次安装必读

由于安装包未做 Apple 代码签名，从浏览器下载后双击 `.dmg` 可能提示「文件已损坏」或「无法打开」。**安装包本身没有损坏**，这是 macOS Gatekeeper 对未签名应用的默认拦截行为。

**推荐方法：终端一键安装**

打开「终端」应用（在启动台搜索"终端"，或在「应用程序 → 实用工具」里找到），复制粘贴下面这一行命令并回车，脚本会自动下载、绕过限制并安装到应用程序文件夹：

```bash
curl -fsSL https://raw.githubusercontent.com/Riven-Wood/legal-work-space/main/install-mac.sh | bash
```

脚本会自动识别 Mac 芯片架构（Apple / Intel），下载对应版本并完成全部安装步骤。

**手动方法：先下载再移除隔离属性**

1. 从下方「下载选择」中下载对应的 `.dmg` 文件。
2. 打开「终端」，执行（路径请按实际替换）：

   ```bash
   xattr -d com.apple.quarantine ~/Downloads/Legal-Work-Space-1.1.0-mac-arm64.dmg
   ```

3. 双击 dmg，将 `Legal Work Space` 拖入「应用程序」即可。
4. 若启动时仍提示无法打开，对 `.app` 也执行一次：

   ```bash
   sudo xattr -cr "/Applications/Legal Work Space.app"
   ```

> 注：macOS 15+ 收紧了 Gatekeeper，「右键 → 打开」的绕过方式可能失效，请使用上述终端方法。

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

详见上方「macOS 用户：首次安装必读」，推荐使用一键安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/Riven-Wood/legal-work-space/main/install-mac.sh | bash
```

如需手动操作，下载 `.dmg` 后执行：

```bash
xattr -d com.apple.quarantine ~/Downloads/Legal-Work-Space-1.1.0-mac-arm64.dmg
```

再双击 dmg 完成安装。

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
