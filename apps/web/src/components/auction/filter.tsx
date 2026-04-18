"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";

interface FilterProps {
  label: string;
  options: string[];
  selected: string[];
  onSelect: (selected: string[]) => void;
}

export function Filter({ label, options, selected, onSelect }: FilterProps) {
  const [open, setOpen] = useState(false);

  const allSelected = selected.length === options.length;
  const noneSelected = selected.length === 0;

  function toggleAll() {
    if (allSelected) {
      onSelect([]);
    } else {
      onSelect([...options]);
    }
  }

  function toggleOption(option: string) {
    if (selected.includes(option)) {
      onSelect(selected.filter((s) => s !== option));
    } else {
      onSelect([...selected, option]);
    }
  }

  const triggerLabel =
    noneSelected || allSelected
      ? "All"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={`Filter by ${label}`}
        >
          {label}
          {!noneSelected && !allSelected && (
            <span className="ml-0.5 flex size-4.5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={toggleAll}>
                <div
                  className={cn(
                    "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                    allSelected || noneSelected
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50 [&_svg]:invisible",
                  )}
                >
                  <Check className="size-3" />
                </div>
                All
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <CommandItem
                    key={option}
                    onSelect={() => toggleOption(option)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-3" />
                    </div>
                    {option}
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
