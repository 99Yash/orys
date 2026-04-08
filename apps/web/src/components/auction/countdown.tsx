"use client";

import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

function parseTime(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "Ended";
  const { days, hours, minutes, seconds } = parseTime(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <span className="tabular-nums">
      <span className="text-2xl font-bold text-foreground">
        {String(value).padStart(2, "0")}
      </span>
      <span className="ml-0.5 text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

export function Countdown({
  endsAt,
  variant = "inline",
}: {
  endsAt: string;
  variant?: "inline" | "segmented";
}) {
  const [timeLeft, setTimeLeft] = useState(() =>
    new Date(endsAt).getTime() - Date.now(),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(new Date(endsAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const isUrgent = timeLeft > 0 && timeLeft < 180_000;

  if (variant === "segmented") {
    if (timeLeft <= 0) {
      return (
        <p className="text-sm font-medium text-muted-foreground">
          Auction ended
        </p>
      );
    }

    const { days, hours, minutes, seconds } = parseTime(timeLeft);

    return (
      <div
        className={cn(
          "flex items-baseline gap-1.5",
          isUrgent && "animate-pulse",
        )}
      >
        {days > 0 && (
          <>
            <TimeUnit value={days} label="d" />
            <span className="mx-0.5 text-lg text-border">:</span>
          </>
        )}
        <TimeUnit value={hours} label="h" />
        <span className="mx-0.5 text-lg text-border">:</span>
        <TimeUnit value={minutes} label="m" />
        <span className="mx-0.5 text-lg text-border">:</span>
        <TimeUnit value={seconds} label="s" />
      </div>
    );
  }

  return (
    <span
      className={cn(
        "tabular-nums",
        isUrgent && "animate-pulse font-semibold text-destructive",
      )}
    >
      {formatTimeLeft(timeLeft)}
    </span>
  );
}
