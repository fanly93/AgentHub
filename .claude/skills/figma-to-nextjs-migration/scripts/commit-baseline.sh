#!/usr/bin/env bash
set -e

# commit-baseline.sh — 固化迁移基线（Step 8，不可跳过）
# 用法：在新 Next.js 项目目录下运行 bash commit-baseline.sh
# 作用：git add -A + git commit，把搬家过程对预装文件的覆盖纳入版本控制
#
# 为什么这一步最容易被漏：
#   create-next-app 自动初始化 git 仓库（有一条 "Initial commit from Create Next App"）
#   搬家过程对 src/app/page.tsx / layout.tsx / globals.css 的覆盖还在 working tree
#   如果还没 commit 就跑 git reset --hard HEAD，这三个文件会被打回脚手架默认值：
#     - 首页变 Next.js 欢迎页
#     - 样式 token 全丢（bg-bg-base / text-fg-default 等全部失效）
#     - 字体打回 Geist 默认
#   其他新建路由（/pricing /gallery 等）是 untracked，reset 不会动，看起来"只坏了首页"
#   实际上是一整类 scaffold 文件没被守护

# 检查是否在 git 仓库里
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ 当前目录不是 git 仓库"
  echo "  请在 Next.js 项目目录下运行此脚本"
  exit 1
fi

# 检查工作树是否有变更（修改 + 未跟踪文件）
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$((STAGED + UNSTAGED + UNTRACKED))

if [ "$TOTAL" -eq 0 ]; then
  echo "ℹ️  工作树无变更，无需 commit"
  echo "  可能已经 commit 过了，用 git log --oneline 确认"
  exit 0
fi

echo "📸 固化迁移基线..."
echo "  变更文件数：$TOTAL（已暂存 $STAGED + 未暂存 $UNSTAGED + 新文件 $UNTRACKED）"
echo ""

git add -A
git commit -m "migration complete: figma-make starter → next.js 15 app router"

echo ""
echo "✅ 基线已固化"
echo "  运行 git log --oneline 查看提交记录"
echo "  搬家完成标志：第一行是 'migration complete: figma-make starter → next.js 15 app router'"
