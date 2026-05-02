"use client";

import { useEffect, useRef, useState } from "react";

export function useRetryCountdown(retryAfterMs: number | undefined): {
  secondsLeft: number;
  isActive: boolean;
} {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!retryAfterMs || retryAfterMs <= 0) {
      setSecondsLeft(0);
      return;
    }

    const total = Math.ceil(retryAfterMs / 1000);
    setSecondsLeft(total);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [retryAfterMs]);

  return { secondsLeft, isActive: secondsLeft > 0 };
}
