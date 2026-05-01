"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { ToolName } from "@/shared/schemas/agentStream";

const TOOLS: { name: ToolName; label: string }[] = [
  { name: "get_current_time", label: "获取当前时间" },
  { name: "calculate", label: "数学计算" },
  { name: "web_search", label: "联网检索" },
  { name: "get_weather", label: "查询天气" },
  { name: "write_file", label: "写入本地文件" },
];

interface ToolPanelProps {
  selectedTools: ToolName[];
  onChange: (tools: ToolName[]) => void;
  disabled: boolean;
}

export function ToolPanel({ selectedTools, onChange, disabled }: ToolPanelProps) {
  const toggle = (name: ToolName) => {
    if (disabled) return;
    if (selectedTools.includes(name)) {
      onChange(selectedTools.filter((t) => t !== name));
    } else {
      onChange([...selectedTools, name]);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">
        工具{selectedTools.length > 0 ? `（已选 ${selectedTools.length} 个，启用 Agent 模式）` : "（可选，选中后启用 Agent 工具调用）"}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {TOOLS.map((tool) => (
          <label
            key={tool.name}
            className="flex cursor-pointer items-center gap-2 text-sm select-none disabled:cursor-not-allowed"
          >
            <Checkbox
              checked={selectedTools.includes(tool.name)}
              onCheckedChange={() => toggle(tool.name)}
              disabled={disabled}
            />
            <span className={disabled ? "text-muted-foreground" : ""}>{tool.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
