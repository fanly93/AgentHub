#!/usr/bin/env bash
set -e

# create-next-scaffold.sh — 创建 Next.js 15 App Router 脚手架
# 用法：bash create-next-scaffold.sh <新项目名>
# 示例：bash create-next-scaffold.sh agenthub
# 注意：在项目父目录下运行（不要在源项目目录里运行）

PROJECT_NAME="${1:-}"

if [ -z "$PROJECT_NAME" ]; then
  echo "用法: $0 <新项目名>"
  echo "示例: $0 agenthub"
  exit 1
fi

if [ -d "$PROJECT_NAME" ]; then
  echo "错误：目录已存在 → $PROJECT_NAME"
  echo "请换一个项目名，或先删除已有目录。"
  exit 1
fi

echo "🚀 创建 Next.js 脚手架：$PROJECT_NAME"
echo ""
echo "参数说明："
echo "  --typescript     使用 TypeScript"
echo "  --tailwind       安装 Tailwind v4"
echo "  --app            使用 App Router（不用 Pages Router）"
echo "  --src-dir        代码放 src/ 目录下"
echo "  --no-eslint      暂不开 ESLint（搬家阶段减少干扰）"
echo "  --no-turbopack   使用稳定的 Webpack（Turbopack 有 shadcn 兼容问题）"
echo "  --import-alias   路径别名 @/* 对齐源项目"
echo "  --use-pnpm       使用 pnpm 包管理器"
echo ""

pnpm create next-app@latest "$PROJECT_NAME" \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --no-turbopack \
  --import-alias "@/*" \
  --use-pnpm

echo ""
echo "✅ 脚手架创建完成：$PROJECT_NAME"
echo ""
echo "下一步："
echo "  cd $PROJECT_NAME"
echo "  pnpm dev  # 验证 Next.js 欢迎页出现，Ctrl+C 停掉后继续搬家"
echo ""
echo "⚠️  注意：create-next-app 已自动初始化 git 仓库（有一条 Initial commit）"
echo "   搬家过程中的修改需要在 Step 8 手动 commit 固化，否则 reset 会吞掉所有改动。"
