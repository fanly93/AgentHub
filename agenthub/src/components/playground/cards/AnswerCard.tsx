"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Skeleton } from "@/components/ui/skeleton";

interface AnswerCardProps {
  content: string | undefined;
  isStreaming: boolean;
}

export function AnswerCard({ content, isStreaming }: AnswerCardProps) {
  if (!content && isStreaming) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        最终答案
      </p>
      <div className="overflow-x-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          {isStreaming && (
            <span className="ml-0.5 animate-pulse text-foreground">▋</span>
          )}
        </div>
      </div>
    </div>
  );
}
