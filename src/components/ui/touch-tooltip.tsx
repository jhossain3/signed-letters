import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TouchTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}

/**
 * A tooltip that works on both desktop (hover) and mobile (tap to toggle).
 * Uses Tooltip on desktop and Popover on mobile/touch devices.
 */
export function TouchTooltip({ children, content, className }: TouchTooltipProps) {
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);

  React.useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  if (isTouchDevice) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className={className ?? "max-w-xs text-xs p-3"} side="top">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={className ?? "max-w-xs text-xs"}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
