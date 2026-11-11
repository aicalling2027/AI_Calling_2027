"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Circle, type LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * Radix dropdown with a spring entrance from the side it opens towards.
 * The motion wrapper is what replaces the stock CSS keyframes.
 */

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const MotionContent = React.forwardRef<
  React.ComponentRef<typeof motion.div>,
  React.ComponentPropsWithoutRef<typeof motion.div> & {
    side?: "top" | "right" | "bottom" | "left";
  }
>(({ children, side = "bottom", ...props }, ref) => {
  // Enter from the side the menu is anchored to, so the panel grows out of the
  // trigger instead of out of its own centre.
  function getInitialPosition() {
    switch (side) {
      case "top":
        return { y: 8 };
      case "right":
        return { x: -8 };
      case "left":
        return { x: 8 };
      default:
        return { y: -8 };
    }
  }

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        scale: 0.95,
        ...getInitialPosition(),
      }}
      animate={{
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
      }}
      exit={{
        opacity: 0,
        scale: 0.95,
        ...getInitialPosition(),
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
        duration: 0.2,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
});
MotionContent.displayName = "MotionContent";

const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
    icon?: LucideIcon;
  }
>(({ className, inset, children, icon: Icon, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-sm select-none outline-none transition-colors sm:py-2",
      "hover:bg-accent hover:text-accent-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      "active:bg-accent active:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    <motion.div
      className="flex w-full items-center gap-2 text-sm"
      transition={{ duration: 0.1 }}
      whileHover={{ x: 2 }}
    >
      {Icon ? <Icon className="shrink-0" size={16} /> : null}
      <span className="flex-1">{children}</span>
      <ChevronRight className="ml-auto h-4 w-4" />
    </motion.div>
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 max-w-[95vw] min-w-[8rem] overflow-hidden rounded-xl border border-border bg-background p-1 text-foreground shadow-lg sm:max-w-[280px]",
      className,
    )}
    asChild
    {...props}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.95, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: -8 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
        duration: 0.15,
      }}
    >
      {children}
    </motion.div>
  </DropdownMenuPrimitive.SubContent>
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <AnimatePresence>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-[95vw] min-w-[8rem] overflow-hidden rounded-xl border border-border bg-background p-1 text-foreground shadow-xl sm:max-w-[350px]",
          className,
        )}
        asChild
        {...props}
      >
        <MotionContent>{children}</MotionContent>
      </DropdownMenuPrimitive.Content>
    </AnimatePresence>
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

// This theme maps --accent to brand tangerine (with ink text) and has no
// --destructive-foreground token, so the destructive variant flips to white.
const dropdownMenuItemVariants = cva(
  "relative flex cursor-default touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-sm select-none outline-none transition-colors sm:py-2",
  {
    variants: {
      variant: {
        default:
          "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground active:bg-accent active:text-accent-foreground",
        destructive:
          "text-destructive hover:bg-destructive hover:text-white focus:bg-destructive focus:text-white active:bg-destructive active:text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    icon?: LucideIcon;
    shortcut?: string;
  } & VariantProps<typeof dropdownMenuItemVariants>
>(
  (
    { className, variant, inset, icon: Icon, shortcut, children, ...props },
    ref,
  ) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        dropdownMenuItemVariants({ variant }),
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      <motion.div
        className="flex w-full items-center gap-2 text-sm"
        transition={{ duration: 0.1 }}
        whileHover={{ x: 2 }}
      >
        {Icon ? <Icon className="shrink-0" size={16} /> : null}
        <span className="flex-1 text-sm">{children}</span>
        {shortcut ? (
          <Kbd className="ml-auto text-xs tracking-widest opacity-60" size="xs">
            {shortcut}
          </Kbd>
        ) : null}
      </motion.div>
    </DropdownMenuPrimitive.Item>
  ),
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & {
    icon?: LucideIcon;
  }
>(({ className, children, checked, icon: Icon, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default touch-manipulation items-center rounded-xl py-2.5 pr-3 pl-8 text-sm select-none outline-none transition-colors sm:py-2",
      "hover:bg-accent hover:text-accent-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      "active:bg-accent active:text-accent-foreground",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.1 }}
        >
          <Check className="h-4 w-4" />
        </motion.div>
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    <motion.div
      className="flex w-full items-center gap-2 text-sm"
      transition={{ duration: 0.1 }}
      whileHover={{ x: 2 }}
    >
      {Icon ? <Icon className="shrink-0" size={16} /> : null}
      {children}
    </motion.div>
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
    icon?: LucideIcon;
  }
>(({ className, children, icon: Icon, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default touch-manipulation items-center rounded-xl py-2.5 pr-3 pl-8 text-sm select-none outline-none transition-colors sm:py-2",
      "hover:bg-accent hover:text-accent-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      "active:bg-accent active:text-accent-foreground",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.1 }}
        >
          <Circle className="h-2 w-2 fill-current" />
        </motion.div>
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    <motion.div
      className="flex w-full items-center gap-2 text-sm"
      transition={{ duration: 0.1 }}
      whileHover={{ x: 2 }}
    >
      {Icon ? <Icon className="shrink-0" size={16} /> : null}
      {children}
    </motion.div>
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName =
  DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
    icon?: LucideIcon;
  }
>(({ className, inset, icon: Icon, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-muted-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {Icon ? <Icon className="shrink-0" size={16} /> : null}
    {children}
  </DropdownMenuPrimitive.Label>
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName =
  DropdownMenuPrimitive.Separator.displayName;

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  );
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  dropdownMenuItemVariants,
};
