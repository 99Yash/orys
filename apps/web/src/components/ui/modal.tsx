"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
import { useMediaQuery } from "~/lib/hooks/use-media-query";
import { cn } from "~/lib/utils";

interface ModalProps {
  children: React.ReactNode;
  className?: string;
  showModal?: boolean;
  setShowModal?: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
  preventDefaultClose?: boolean;
  desktopOnly?: boolean;
  title?: string;
  description?: string;
}

export function Modal({
  children,
  className,
  showModal,
  setShowModal,
  onClose,
  preventDefaultClose,
  desktopOnly,
  title,
  description,
}: ModalProps) {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 780px)");

  const isControlled = showModal !== undefined && setShowModal !== undefined;

  const handleClose = () => {
    if (preventDefaultClose) return;
    if (onClose) {
      onClose();
    } else if (isControlled) {
      setShowModal(false);
    } else {
      router.back();
    }
  };

  if (isMobile && !desktopOnly) {
    return (
      <Drawer
        open={isControlled ? showModal : true}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DrawerContent className={cn("max-h-[85vh]", className)}>
          {(title || description) && (
            <DrawerHeader className="text-left">
              {title && <DrawerTitle>{title}</DrawerTitle>}
              {description && (
                <DrawerDescription>{description}</DrawerDescription>
              )}
            </DrawerHeader>
          )}
          <div className="overflow-y-auto px-4 pb-4">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={isControlled ? showModal : true}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className={cn("sm:max-w-md", className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
