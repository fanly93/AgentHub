#!/usr/bin/env bash
set -e

# backup.sh — 备份 Figma Make / v0.dev 原项目（带时间戳）
# 用法：bash backup.sh <源项目目录>
# 示例：bash backup.sh "Start Project"
# 输出：<源项目目录>.backup-20240420143022

SOURCE="${1:-}"

if [ -z "$SOURCE" ]; then
  echo "用法: $0 <源项目目录>"
  echo "示例: $0 \"Start Project\""
  exit 1
fi

if [ ! -d "$SOURCE" ]; then
  echo "错误：目录不存在 → $SOURCE"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP="${SOURCE}.backup-${TIMESTAMP}"

echo "📦 备份中..."
echo "  来源：$SOURCE"
echo "  目标：$BACKUP"

cp -r "$SOURCE" "$BACKUP"

echo "✅ 备份完成：$BACKUP"
echo ""
echo "提示：备份目录请保持只读，不要修改——这是你的'设计参考底稿'。"
