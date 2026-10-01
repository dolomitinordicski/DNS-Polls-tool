import { useEffect, useRef, type RefObject } from 'react';

interface AccessibleDialogOptions<T extends HTMLElement> {
  isOpen: boolean;
  onClose: () => void;
  dialogRef: RefObject<T | null>;
  initialFocusSelector?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;

    const focusInitialElement = () => {
      const requested = initialFocusSelector
        ? dialog.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const firstFocusable =
        requested ||
        dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ||
        dialog;

      firstFocusable.focus({ preventScroll: true });
    };

    const frame = window.requestAnimationFrame(focusInitialElement);
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(element => {
        const style = window.getComputedStyle(element);
        return (
          !element.hasAttribute('disabled') &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      });

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [dialogRef, initialFocusSelector, isOpen]);
}
