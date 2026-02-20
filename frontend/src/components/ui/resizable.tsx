import { GripVertical, GripHorizontal } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof Group>) => (
  <Group
    className={cn("flex h-full w-full", className)}
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "group relative flex items-center justify-center bg-border",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=horizontal]:cursor-row-resize",
      "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px data-[orientation=vertical]:cursor-col-resize",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex items-center justify-center rounded-sm border bg-border group-data-[orientation=horizontal]:h-3 group-data-[orientation=horizontal]:w-6 group-data-[orientation=vertical]:h-6 group-data-[orientation=vertical]:w-3">
        <GripVertical className="h-2.5 w-2.5 group-data-[orientation=horizontal]:hidden" />
        <GripHorizontal className="h-2.5 w-2.5 group-data-[orientation=vertical]:hidden" />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
