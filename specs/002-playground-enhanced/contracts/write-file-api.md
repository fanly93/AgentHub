# API 契约：文件写入接口

**端点**：`POST /api/tools/write-file`  
**运行时**：Node.js Runtime（默认，无 `export const runtime = "edge"` 声明）  
**调用方**：仅限 `/api/agent/stream`（内部服务间调用，不对浏览器客户端暴露）

---

## 安全说明

此接口写入本地文件系统，因此存在路径穿越风险。以下安全措施为必须实现项：

1. **白名单正则**：filename 必须匹配 `/^[a-zA-Z0-9_\-]+$/`，不允许任何路径字符
2. **path.basename 过滤**：对 filename 执行 `path.basename()` 去除路径部分
3. **路径前缀校验**：`targetPath.startsWith(downloadsDir)` 确认目标在 downloads/ 内
4. **文件大小校验**：content UTF-8 编码后 ≤ 1,048,576 bytes（1MB）
5. **仅支持 .txt 扩展名**：扩展名由服务端固定追加，调用方不得指定

---

## 请求

### Headers

| Header | 必填 | 说明 |
|--------|------|------|
| `Content-Type` | 是 | `application/json` |

### Body（JSON）

```json
{
  "filename": "ai_intro",
  "content": "# AI 简介\n\n这是由 AI 生成的文件内容..."
}
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| filename | `string` | 必填，匹配 `[a-zA-Z0-9_\-]+`，≤100 字 | 文件名（不含路径，不含扩展名） |
| content | `string` | 必填，UTF-8 编码 ≤1MB | 要写入的文本内容 |

---

## 响应

### 成功：200 OK

```json
{
  "success": true,
  "path": "/Users/username/VibeCoding/AgentHub/agenthub/downloads/ai_intro.txt",
  "overwritten": false
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| success | `true` | 写入成功 |
| path | `string` | 文件的绝对路径 |
| overwritten | `boolean` | 是否覆盖了已有同名文件 |

### 失败：400 Bad Request

```json
{
  "success": false,
  "error": "文件名不合法，不允许包含路径分隔符或特殊字符",
  "code": "INVALID_FILENAME"
}
```

| status | code | 触发条件 |
|--------|------|---------|
| 400 | `INVALID_FILENAME` | filename 不符合白名单正则 |
| 400 | `CONTENT_TOO_LARGE` | content 超过 1MB |
| 500 | `WRITE_FAILED` | 文件系统写入失败（磁盘满、权限不足等） |

---

## 文件系统规范

- **写入目录**：`{project_root}/downloads/`（项目根目录下，即 `process.cwd()` + `'/downloads'`）
- **文件扩展名**：固定为 `.txt`（UTF-8 编码）
- **目录自动创建**：写入前执行 `fs.mkdir(downloadsDir, { recursive: true })`，首次调用自动创建
- **同名覆盖**：目标路径已存在同名文件时，直接覆盖，`overwritten` 字段返回 `true`
- **编码**：UTF-8

---

## 调用示例（Edge Runtime 中的调用方式）

```typescript
// /api/agent/stream route.ts 中的 write_file.execute()
const origin = new URL(req.url).origin;
const response = await fetch(`${origin}/api/tools/write-file`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename, content }),
});

if (!response.ok) {
  const err = await response.json();
  return { success: false, error: err.error };
}

const data = await response.json();
return {
  success: true,
  message: `文件已保存到 ${data.path}${data.overwritten ? '（已覆盖原有文件）' : ''}`,
};
```
