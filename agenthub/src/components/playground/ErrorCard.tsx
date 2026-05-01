"use client";

import { XCircle, AlertTriangle, Clock } from "lucide-react";
import { useRetryCountdown } from "@/hooks/useRetryCountdown";
import type { PlaygroundError } from "@/shared/schemas/playgroundResponse";

interface ErrorCardProps {
  error: (PlaygroundError & { message: string }) | null;
  /** 流式传输中断时，保留已有内容并展示黄色警告条（非卡片模式） */
  streamInterrupted?: boolean;
}

export function ErrorCard({ error, streamInterrupted }: ErrorCardProps) {
  const { secondsLeft, isActive } = useRetryCountdown(
    error?.tier === "retryable" ? error.retryAfterMs : undefined
  );

  if (streamInterrupted) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>传输中断，以下为部分结果</span>
      </div>
    );
  }

  if (!error) return null;

  const isFatal = error.tier === "fatal";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        isFatal
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-warning/40 bg-warning/10 text-warning"
      }`}
    >
      {isFatal ? (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{error.message}</p>
        {error.code && (
          <p className="font-mono text-xs opacity-60">{error.code}</p>
        )}
        {isActive && (
          <p className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {secondsLeft}s 后可重试
          </p>
        )}
      </div>
    </div>
  );
}
