"use client";

import { parsePartialJson } from "ai";
import { useCallback, useRef, useState } from "react";

// ai v6 不导出 DeepPartial，本地定义
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type UseStructuredStreamOptions<T> = {
  api: string;
  onFinish?: (opts: { object: T | undefined }) => void;
  onError?: (error: Error & Record<string, unknown>) => void;
};

export type UseStructuredStreamResult<T, INPUT = Record<string, unknown>> = {
  object: DeepPartial<T> | undefined;
  isLoading: boolean;
  error: (Error & Record<string, unknown>) | undefined;
  submit: (input: INPUT, headers?: Record<string, string>) => Promise<void>;
  stop: () => void;
};

export function useStructuredStream<T, INPUT = Record<string, unknown>>({
  api,
  onFinish,
  onError,
}: UseStructuredStreamOptions<T>): UseStructuredStreamResult<T, INPUT> {
  const [object, setObject] = useState<DeepPartial<T> | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<(Error & Record<string, unknown>) | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const submit = useCallback(
    async (input: INPUT, headers?: Record<string, string>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setObject(undefined);
      setError(undefined);

      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json();
          const err = Object.assign(
            new Error(errBody.message ?? "Request failed"),
            errBody
          ) as Error & Record<string, unknown>;
          setError(err);
          setIsLoading(false);
          onError?.(err);
          return;
        }

        if (!res.body) {
          throw new Error("No response body");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += decoder.decode(value, { stream: true });

          // parsePartialJson 处理不完整 JSON，流式过程中逐步更新对象
          const parsed = await parsePartialJson(accumulated);
          if (parsed.value !== undefined) {
            setObject(parsed.value as DeepPartial<T>);
          }
        }

        // 流关闭后做最终解析
        const final = await parsePartialJson(accumulated);
        const finalObject = final.value as T | undefined;
        setIsLoading(false);
        onFinish?.({ object: finalObject });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setIsLoading(false);
          return;
        }
        const base = err instanceof Error ? err : new Error(String(err));
        const error = base as unknown as Error & Record<string, unknown>;
        error["tier"] = "retryable";
        error["code"] = "STREAM_INTERRUPTED";
        setError(error);
        setIsLoading(false);
        onError?.(error);
      }
    },
    [api, onFinish, onError]
  );

  return { object, isLoading, error, submit, stop };
}
