"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { useState } from "react";

interface ThinkingCardProps {
  content: string | undefined;
  isStreaming: boolean;
}

export function ThinkingCard({ content, isStreaming }: ThinkingCardProps) {
  const isLong = (content?.length ?? 0) > 10000;
  const [open, setOpen] = useState(!isLong);

  if (!content && isStreaming) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!content) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card p-4">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <Brain className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            思考过程
            {content && (
              <span className="ml-1 normal-case text-muted-foreground/60">
                ({content.length.toLocaleString()} 字)
              </span>
            )}
          </p>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {content}
            {isStreaming && (
              <span className="ml-0.5 animate-pulse text-foreground">▋</span>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
