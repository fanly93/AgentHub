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
import type { ToolCall } from "@/shared/schemas/playgroundResponse";
import type { AgentToolCall } from "@/shared/schemas/agentStream";

// ── Legacy mode (no-tool playground) ──────────────────────────────────────

interface LegacyProps {
  toolCalls: ToolCall[] | undefined;
  isStreaming: boolean;
  agentCall?: never;
  isPending?: never;
}

// ── Agent mode (single tool call card) ────────────────────────────────────

interface AgentProps {
  agentCall: AgentToolCall;
  isPending?: boolean;
  toolCalls?: never;
  isStreaming?: never;
}

type ToolCallCardProps = LegacyProps | AgentProps;

export function ToolCallCard(props: ToolCallCardProps) {
  // Agent mode
  if (props.agentCall) {
    const { agentCall, isPending } = props;
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {agentCall.name}
          </span>
          <span className="text-xs text-muted-foreground">工具调用</span>
        </div>
        {isPending ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : (
          <pre className="overflow-x-auto rounded bg-muted px-3 py-2 text-xs">
            {JSON.stringify(agentCall.arguments, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // Legacy mode
  const { toolCalls, isStreaming } = props;

  if (!toolCalls && isStreaming) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        工具调用 ({toolCalls.length})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">工具名称</TableHead>
            <TableHead>参数</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {toolCalls.map((tc, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-sm">{tc.name}</TableCell>
              <TableCell>
                <pre className="overflow-x-auto rounded bg-muted px-2 py-1 text-xs">
                  {JSON.stringify(tc.arguments, null, 2)}
                </pre>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
