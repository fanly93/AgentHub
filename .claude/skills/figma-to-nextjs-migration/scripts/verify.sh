#!/usr/bin/env bash
set -e

# verify.sh — 搬家后一键验证（7 个路由 + git 基线状态）
# 用法：在 Next.js 项目目录下运行 bash verify.sh [端口号]
# 示例：bash verify.sh         （默认端口 3000）
#        bash verify.sh 3001   （指定端口）
# 前置条件：pnpm dev 已在后台运行（另开一个终端）

PORT="${1:-3000}"
BASE_URL="http://localhost:$PORT"

ROUTES=(
  "/"
  "/pricing"
  "/gallery"
  "/agent/agent-1"
  "/runs"
  "/settings"
  "/pipeline"
)

ROUTE_NAMES=(
  "Landing（首页）"
  "Pricing（定价）"
  "Gallery（商店）"
  "AgentDetail（Agent 详情）"
  "RunHistory（运行历史）"
  "Settings（设置）"
  "Pipeline（流水线）"
)

echo "🔍 验证 Next.js 迁移结果"
echo "  地址：$BASE_URL"
echo "  前置条件：pnpm dev 已在另一个终端运行"
echo ""

# 检查 dev server 是否运行
if ! curl -s -o /dev/null -w "" "$BASE_URL" 2>/dev/null; then
  echo "❌ 无法连接到 $BASE_URL"
  echo "  请先在另一个终端运行 pnpm dev，再执行此脚本"
  exit 1
fi

PASS=0
FAIL=0

for i in "${!ROUTES[@]}"; do
  route="${ROUTES[$i]}"
  name="${ROUTE_NAMES[$i]}"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$route" 2>/dev/null || echo "000")

  if [ "$STATUS" = "200" ]; then
    echo "  ✅ $route  →  $name ($STATUS)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $route  →  $name ($STATUS)"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "路由结果：$PASS 通过 / $FAIL 失败 / 共 ${#ROUTES[@]} 个"
echo ""

# 检查 git 基线
echo "── Git 基线检查 ──────────────────────────"
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "  ⚠️  当前目录不是 git 仓库"
elif git log --oneline 2>/dev/null | head -1 | grep -q "migration complete"; then
  COMMIT_MSG=$(git log --oneline 2>/dev/null | head -1)
  echo "  ✅ 基线已固化：$COMMIT_MSG"
else
  LATEST=$(git log --oneline 2>/dev/null | head -1)
  echo "  ⚠️  未找到 'migration complete' commit"
  echo "  最新 commit：$LATEST"
  echo "  提示：运行 scripts/commit-baseline.sh 固化基线（Step 8）"
fi

echo ""

# 总结
if [ "$FAIL" -gt 0 ]; then
  echo "❌ 验证未通过（$FAIL 个路由失败）"
  echo "  排查建议："
  echo "  1. 检查 pnpm dev 控制台是否有编译错误"
  echo "  2. 对应路由的 page.tsx 是否存在"
  echo "  3. 页面文件是否有语法错误（pnpm build 看完整报错）"
  echo "  4. 查阅 references/common-errors.md"
  exit 1
else
  echo "✅ 所有路由验证通过！搬家成功。"
fi
