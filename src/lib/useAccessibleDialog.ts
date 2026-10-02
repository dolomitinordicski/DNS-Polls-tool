import { useEffect, useRef, type RefObject } from 'react';
import { openDNSOverlay } from '@dolomitinordicski/dns-shared-data/ui/overlay';

interface AccessibleDialogOptions<T extends HTMLElement> {
  isOpen: boolean;
  onClose: () => void;
  dialogRef: RefObject<T | null>;
  initialFocusSelector?: string;
}

export function useAccessibleDialog<T extends HTMLElement>({
  isOpen,
  onClose,
  dialogRef,
  initialFocusSelector,
}: AccessibleDialogOptions<T>) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const initialFocus = initialFocusSelector
      ? dialog.querySelector<HTMLElement>(initialFocusSelector)
      : null;

    const overlay = openDNSOverlay({
      type: 'modal',
      element: dialog,
      initialFocus,
      closeOnBackdrop: false,
      onClose: () => onCloseRef.current(),
    });

    return () => {
      overlay.disconnect();
      document.body.style.overflow = previousOverflow;
    };
  }, [dialogRef, initialFocusSelector, isOpen]);
}
