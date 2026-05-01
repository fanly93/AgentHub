"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODEL_LIST, DEFAULT_MODEL } from "@/lib/models";
import type { ModelId } from "@/shared/schemas/playgroundResponse";

interface ModelSelectorProps {
  value: ModelId;
  onChange: (value: ModelId) => void;
  disabled?: boolean;
}

// 按供应商分组
const PROVIDERS = ["DeepSeek", "OpenAI", "Anthropic", "Google", "Alibaba"];

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ModelId)}
      disabled={disabled}
      defaultValue={DEFAULT_MODEL}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="选择模型" />
      </SelectTrigger>
      <SelectContent>
        {PROVIDERS.map((provider) => {
          const models = MODEL_LIST.filter((m) => m.provider === provider);
          if (models.length === 0) return null;
          return (
            <SelectGroup key={provider}>
              <SelectLabel className="text-xs text-muted-foreground">{provider}</SelectLabel>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
