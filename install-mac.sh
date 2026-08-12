#!/bin/bash
# Legal Work Space 一键安装脚本 (macOS)
#
# 用法（在「终端」应用中执行这一行即可）：
#   curl -fsSL https://raw.githubusercontent.com/Riven-Wood/legal-work-space/main/install-mac.sh | bash
#
# 脚本会自动：
#   1. 检测 Mac 芯片架构（Apple / Intel）
#   2. 查询 GitHub Releases 最新版本
#   3. 下载对应的 .dmg 安装包
#   4. 移除 macOS 隔离属性（绕过「文件已损坏」提示）
#   5. 将应用安装到 /Applications
#   6. 启动应用

set -e

REPO="Riven-Wood/legal-work-space"
APP_NAME="Legal Work Space"
APP_PATH="/Applications/${APP_NAME}.app"

# 终端颜色（如果终端不支持会自动忽略）
if [[ -t 1 ]]; then
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[1;33m'
  RED=$'\033[0;31m'
  CYAN=$'\033[0;36m'
  BOLD=$'\033[1m'
  NC=$'\033[0m'
else
  GREEN=""; YELLOW=""; RED=""; CYAN=""; BOLD=""; NC=""
fi

echo ""
echo "${GREEN}${BOLD}=== Legal Work Space 一键安装 ===${NC}"
echo ""

# 检查系统
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "${RED}此脚本仅支持 macOS。Windows 用户请直接运行 .exe 安装包。${NC}"
  exit 1
fi

# 检查必要命令
for cmd in curl hdiutil xattr; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "${RED}缺少必要命令：$cmd${NC}"
    exit 1
  fi
done

# 检测架构
ARCH=$(uname -m)
case "$ARCH" in
  arm64)
    ARCH_TAG="arm64"
    echo "${CYAN}检测到 Apple 芯片 (arm64)${NC}"
    ;;
  x86_64)
    ARCH_TAG="x64"
    echo "${CYAN}检测到 Intel 芯片 (x64)${NC}"
    ;;
  *)
    echo "${RED}不支持的芯片架构：$ARCH${NC}"
    exit 1
    ;;
esac

# 查询最新版本
echo ""
echo "正在查询最新版本..."
LATEST_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")

VERSION=$(echo "$LATEST_JSON" | grep -m1 '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/')
if [[ -z "$VERSION" ]]; then
  echo "${RED}无法获取最新版本号${NC}"
  exit 1
fi

DMG_URL=$(echo "$LATEST_JSON" | grep "browser_download_url" | grep "mac-${ARCH_TAG}.dmg" | sed -E 's/.*"([^"]+)".*/\1/')
if [[ -z "$DMG_URL" ]]; then
  echo "${RED}未找到 macOS ${ARCH_TAG} 版本的 dmg 安装包${NC}"
  echo "${RED}请到 https://github.com/${REPO}/releases/latest 查看可用文件${NC}"
  exit 1
fi

DMG_NAME=$(basename "$DMG_URL")
TMP_DIR=$(mktemp -d)
DMG_PATH="${TMP_DIR}/${DMG_NAME}"

echo "${GREEN}最新版本：v${VERSION}${NC}"
echo "下载地址：${DMG_URL}"
echo ""

# 下载 dmg
echo "正在下载安装包（约 100MB，请稍候）..."
curl -fSL --progress-bar -o "$DMG_PATH" "$DMG_URL"

# 关键步骤：移除隔离属性
echo ""
echo "${YELLOW}正在移除 macOS 隔离属性（绕过「已损坏」提示）...${NC}"
xattr -d com.apple.quarantine "$DMG_PATH" 2>/dev/null || true

# 挂载 dmg
echo "正在挂载安装包..."
MOUNT_INFO=$(hdiutil attach "$DMG_PATH" -nobrowse -noautoopen 2>/dev/null)
VOLUME_PATH=$(echo "$MOUNT_INFO" | grep -o '/Volumes/.*$' | sed 's/[[:space:]]*$//' | tail -1)

if [[ -z "$VOLUME_PATH" ]] || [[ ! -d "$VOLUME_PATH" ]]; then
  echo "${RED}挂载 dmg 失败${NC}"
  rm -rf "$TMP_DIR"
  exit 1
fi

# 在挂载的卷中查找 .app
APP_SOURCE=$(find "$VOLUME_PATH" -maxdepth 2 -name "*.app" -print -quit 2>/dev/null)
if [[ -z "$APP_SOURCE" ]]; then
  echo "${RED}未在 dmg 内找到 .app 文件${NC}"
  hdiutil detach "$VOLUME_PATH" >/dev/null 2>&1
  rm -rf "$TMP_DIR"
  exit 1
fi

# 检查旧版本
if [[ -d "$APP_PATH" ]]; then
  echo "检测到旧版本，正在卸载..."
  rm -rf "$APP_PATH"
fi

# 拷贝到 /Applications
echo "正在安装到应用程序文件夹..."
cp -R "$APP_SOURCE" "$APP_PATH"

# 卸载 dmg
echo "正在卸载安装包..."
hdiutil detach "$VOLUME_PATH" >/dev/null 2>&1

# 移除 .app 的隔离属性（防止首次启动被拦截）
xattr -cr "$APP_PATH" 2>/dev/null || true

# 清理临时文件
rm -rf "$TMP_DIR"

# 标记到 Dock（可选，失败不报错）
echo ""
echo "${GREEN}${BOLD}✓ 安装完成！${NC}"
echo ""
echo "应用位置：${APP_PATH}"
echo ""

# 直接启动应用
echo "正在启动 Legal Work Space..."
open "$APP_PATH"

echo ""
echo "${GREEN}应用已启动，可在 Dock 中固定图标方便下次打开。${NC}"
echo ""
