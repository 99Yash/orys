"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "~/components/ui/command";

const SORT_OPTIONS = [
  { field: "newest", label: "Newest" },
  { field: "ending-soon", label: "Ending Soon" },
  { field: "most-bids", label: "Most Bids" },
  { field: "highest-bid", label: "Highest Bid" },
] as const;

interface SortValue {
  field: string;
  direction: "asc" | "desc";
}

interface SortProps {
  value: SortValue;
  onChange: (value: SortValue) => void;
}

export function Sort({ value, onChange }: SortProps) {
  const [open, setOpen] = useState(false);

  const currentOption = SORT_OPTIONS.find((o) => o.field === value.field);
  const DirectionIcon = value.direction === "asc" ? ArrowUp : ArrowDown;

  function handleSelect(field: string) {
    if (value.field === field) {
      // Toggle direction on re-select
      onChange({
        field,
        direction: value.direction === "asc" ? "desc" : "asc",
      });
    } else {
      onChange({ field, direction: "desc" });
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowUpDown className="size-3.5 opacity-50" />
          {currentOption?.label ?? "Sort"}
          <DirectionIcon className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {SORT_OPTIONS.map((option) => {
                const isActive = value.field === option.field;
                return (
                  <CommandItem
                    key={option.field}
                    onSelect={() => handleSelect(option.field)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-3.5",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.label}
                    {isActive && (
                      <DirectionIcon className="ml-auto size-3 opacity-50" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
