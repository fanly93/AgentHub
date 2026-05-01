"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ToolResult } from "@/shared/schemas/playgroundResponse";
import type { AgentToolResult } from "@/shared/schemas/agentStream";

// ── Legacy mode (no-tool playground) ──────────────────────────────────────

interface LegacyProps {
  toolResults: ToolResult[] | undefined;
  isStreaming: boolean;
  agentResult?: never;
  isLoading?: never;
}

// ── Agent mode (single tool result card) ──────────────────────────────────

interface AgentProps {
  agentResult: AgentToolResult;
  isLoading?: boolean;
  toolResults?: never;
  isStreaming?: never;
}

type ToolResultCardProps = LegacyProps | AgentProps;

export function ToolResultCard(props: ToolResultCardProps) {
  // Agent mode
  if (props.agentResult !== undefined) {
    const { agentResult, isLoading } = props;

    if (isLoading) {
      return (
        <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {agentResult.name}
          </span>
          <span className="text-xs text-muted-foreground">工具结果</span>
        </div>
        {agentResult.error ? (
          <p className="text-xs text-destructive">{agentResult.error}</p>
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded bg-muted px-3 py-2 text-xs max-w-full">
            {JSON.stringify(agentResult.result, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // Legacy mode
  const { toolResults, isStreaming } = props;

  if (!toolResults && isStreaming) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!toolResults || toolResults.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        工具结果 ({toolResults.length})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">工具名称</TableHead>
            <TableHead>结果</TableHead>
            <TableHead className="w-1/4">错误</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {toolResults.map((tr, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-sm">{tr.name}</TableCell>
              <TableCell>
                <pre className="overflow-x-auto rounded bg-muted px-2 py-1 text-xs">
                  {JSON.stringify(tr.result, null, 2)}
                </pre>
              </TableCell>
              <TableCell>
                {tr.error ? (
                  <span className="text-xs text-destructive">{tr.error}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
