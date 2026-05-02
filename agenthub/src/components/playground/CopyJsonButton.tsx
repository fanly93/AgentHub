"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import type { PlaygroundResponse } from "@/shared/schemas/playgroundResponse";
import type { DeepPartial } from "@/hooks/useStructuredStream";

interface CopyJsonButtonProps {
  data: DeepPartial<PlaygroundResponse> | undefined;
}

export function CopyJsonButton({ data }: CopyJsonButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 不可用时静默忽略
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      disabled={!data}
      className="gap-2 text-xs"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-success" />
          已复制 ✓
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          复制原始 JSON
        </>
      )}
    </Button>
  );
}
