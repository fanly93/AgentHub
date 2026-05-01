"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const CHAR_WARN_THRESHOLD = 4000;

export function PromptInput({ value, onChange, onSubmit, disabled }: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.length;
  const isOverLimit = charCount > CHAR_WARN_THRESHOLD;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const isSubmit = isMac
      ? e.metaKey && e.key === "Enter"
      : e.ctrlKey && e.key === "Enter";
    if (isSubmit && !disabled && value.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleClear = () => {
    onChange("");
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="输入 Prompt，按 Cmd+Enter（Mac）/ Ctrl+Enter（Win）发送…"
          className="min-h-[120px] resize-none pr-10"
        />
        {value && !disabled && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={handleClear}
            aria-label="清空输入"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isOverLimit && (
        <p className="text-xs text-[--warning]">
          内容可能超出模型上限，请注意精简 Prompt
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-xs ${isOverLimit ? "text-[--warning]" : "text-muted-foreground"}`}>
          {charCount.toLocaleString()} 字
        </span>
        <Button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          size="sm"
          className="gap-2"
        >
          <Send className="h-3.5 w-3.5" />
          发送
        </Button>
      </div>
    </div>
  );
}
