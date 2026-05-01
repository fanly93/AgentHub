import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { NextResponse } from "next/server";

// Node.js Runtime（默认，无 export const runtime 声明）

const FILENAME_REGEX = /^[a-zA-Z0-9_\-]+$/;

const RequestSchema = z.object({
  filename: z.string().regex(FILENAME_REGEX).max(100),
  content: z.string(),
});

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体格式错误，需要 JSON", code: "INVALID_FILENAME" },
      { status: 400 }
    );
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "文件名不合法，仅允许字母、数字、下划线和连字符", code: "INVALID_FILENAME" },
      { status: 400 }
    );
  }

  const { filename, content } = parsed.data;

  // 1MB 大小校验
  const byteLength = Buffer.byteLength(content, "utf-8");
  if (byteLength > 1_048_576) {
    return NextResponse.json(
      { success: false, error: "文件内容超出 1MB 限制", code: "CONTENT_TOO_LARGE" },
      { status: 400 }
    );
  }

  const downloadsDir = path.resolve(process.cwd(), "downloads");
  const safeFilename = path.basename(filename) + ".txt";
  const targetPath = path.resolve(downloadsDir, safeFilename);

  // 路径穿越防护
  if (!targetPath.startsWith(downloadsDir + path.sep) && targetPath !== downloadsDir) {
    return NextResponse.json(
      { success: false, error: "文件名不合法，不允许包含路径分隔符或特殊字符", code: "INVALID_FILENAME" },
      { status: 400 }
    );
  }

  try {
    await fs.mkdir(downloadsDir, { recursive: true });

    let overwritten = false;
    try {
      await fs.access(targetPath);
      overwritten = true;
    } catch {
      // 文件不存在，正常继续
    }

    await fs.writeFile(targetPath, content, "utf-8");

    return NextResponse.json({ success: true, path: targetPath, overwritten });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: "文件写入失败：" + (e as Error).message, code: "WRITE_FAILED" },
      { status: 500 }
    );
  }
}
