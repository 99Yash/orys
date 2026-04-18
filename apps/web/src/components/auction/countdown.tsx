"use client";

import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";

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

function TimeUnit({
  value,
  label,
  size = "default",
}: {
  value: number;
  label: string;
  size?: "default" | "compact";
}) {
  return (
    <span className="tabular-nums">
      <span
        className={cn(
          "font-bold text-foreground",
          size === "compact" ? "text-base" : "text-2xl",
        )}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span
        className={cn(
          "text-muted-foreground",
          size === "compact" ? "ml-0.5 text-[10px]" : "ml-0.5 text-xs",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function Countdown({
  endsAt,
  variant = "inline",
}: {
  endsAt: string;
  variant?: "inline" | "segmented" | "compact";
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

  if (variant === "segmented" || variant === "compact") {
    if (timeLeft <= 0) {
      return (
        <p
          className={cn(
            "font-medium text-muted-foreground",
            variant === "compact" ? "text-xs" : "text-sm",
          )}
        >
          Auction ended
        </p>
      );
    }

    const { days, hours, minutes, seconds } = parseTime(timeLeft);
    const unitSize = variant === "compact" ? "compact" : "default";
    const separatorClass = cn(
      "text-border",
      variant === "compact" ? "mx-0.5 text-sm" : "mx-0.5 text-lg",
    );

    return (
      <div
        className={cn(
          "flex items-baseline gap-1.5",
          isUrgent && "animate-pulse",
        )}
      >
        {days > 0 && (
          <>
            <TimeUnit value={days} label="d" size={unitSize} />
            <span className={separatorClass}>:</span>
          </>
        )}
        <TimeUnit value={hours} label="h" size={unitSize} />
        <span className={separatorClass}>:</span>
        <TimeUnit value={minutes} label="m" size={unitSize} />
        <span className={separatorClass}>:</span>
        <TimeUnit value={seconds} label="s" size={unitSize} />
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
