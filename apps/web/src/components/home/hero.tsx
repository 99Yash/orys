"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "../../lib/utils";

const slides = [
  {
    url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1740&auto=format&fit=crop",
  },
  {
    url: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=1740&auto=format&fit=crop",
  },
  {
    url: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?q=80&w=1740&auto=format&fit=crop",
  },
];

export function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 10000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  return (
    <div className="w-full">
      <div className="group relative w-full">
        <div className="relative aspect-[10/3] w-full overflow-hidden rounded-2xl">
          <div
            style={{ backgroundImage: `url(${slides[currentIndex]?.url})` }}
            className="relative flex h-full w-full flex-col justify-center gap-2 bg-cover bg-center px-10 brightness-90 transition-all duration-400 ease-in md:px-20"
          >
            <div className="flex items-center gap-2 max-md:hidden">
              <span className="relative mr-2 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-700 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              <p className="text-xs text-foreground/80">Live Now</p>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground max-xs:text-sm md:text-2xl lg:text-3xl xl:text-4xl">
              A new way to discover and bid on auctions
            </h1>
            <p className="text-sm tracking-tight text-foreground/80 max-sm:hidden md:text-base">
              Post your listing, receive bids in real time, and pick the best
              one.
            </p>
          </div>
        </div>

        <div className="flex justify-center py-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "mx-0.5 size-2 rounded-full transition-colors",
                idx === currentIndex
                  ? "bg-foreground"
                  : "bg-foreground/30",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
