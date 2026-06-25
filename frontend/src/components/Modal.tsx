import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ReactDOM from "react-dom";
import { getFocusableElements, nextFocus, usePortal } from "./HelperFunctions";

interface FrameProps {
  closeOnClickOutside?: boolean;
  closeOnEsc?: boolean;
  confirmCloseMessage?: string;
  onClose: () => void;
  open?: boolean;
  shouldConfirmClose?: () => boolean;
  children: ReactNode;
}

export const ModalFrame: React.FC<FrameProps> = ({
  children,
  closeOnClickOutside = true,
  closeOnEsc = true,
  confirmCloseMessage = "You have unsaved changes. Close anyway?",
  onClose,
  open = true,
  shouldConfirmClose,
}) => {
  const portal = usePortal();
  const previousFocus = useRef<HTMLElement | null>(null);
  const previousOverflow = useRef("");
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  const container = useRef<HTMLDivElement | null>(null);

  const requestClose = useCallback(() => {
    const hasFilledFormFields = () => {
      const fields = Array.from(container.current?.querySelectorAll("input, textarea, select") || []);
      return fields.some((field) => {
        if (field instanceof HTMLInputElement) {
          if (["checkbox", "radio"].includes(field.type)) return field.checked;
          return field.value.trim().length > 0;
        }
        if (field instanceof HTMLTextAreaElement) return field.value.trim().length > 0;
        if (field instanceof HTMLSelectElement) return field.value.trim().length > 0;
        return false;
      });
    };
    const shouldConfirm = shouldConfirmClose ? shouldConfirmClose() : hasFilledFormFields();
    if (shouldConfirm) {
      setIsCloseConfirmOpen(true);
      return;
    }
    onClose();
  }, [onClose, shouldConfirmClose]);

  // Close on click outside
  const onOverlayClick = (e: React.MouseEvent) => {
    if (!container.current?.contains(e.target as Node)) requestClose();
  };

  // ESC + Tab key handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case "Escape":
          if (closeOnEsc) requestClose();
          break;
        case "Tab":
          e.preventDefault();
          nextFocus(getFocusableElements(container.current), !e.shiftKey);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOnEsc, open, requestClose]);

  // Scroll + focus lock
  useEffect(() => {
    document.getElementById("root")?.setAttribute("aria-hidden", open.toString());
    portal.current?.setAttribute("aria-hidden", (!open).toString());

    if (open) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      previousFocus.current = document.activeElement as HTMLElement;
      nextFocus(getFocusableElements(container.current));
    } else {
      document.body.style.overflow = previousOverflow.current;
      previousFocus.current?.focus?.();
      previousFocus.current = null;
    }

    return () => {
      if (open) document.body.style.overflow = previousOverflow.current;
    };
  }, [open, portal]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-claret/60 p-4 sm:p-6 font-pompiere"
      onClick={closeOnClickOutside ? onOverlayClick : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={container}
        className="hide-scrollbar relative flex w-full max-w-2xl max-h-[90vh] min-h-[20vh] flex-col justify-start overflow-y-auto rounded-2xl border border-claret/20 bg-pink p-6 text-claret shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={requestClose}
          aria-label="Close modal"
          className="absolute top-2 right-2 inline-flex size-10 items-center justify-center text-4xl font-bold text-claret hover:text-claret/80"
        >
          ×
        </button>

        {children}
      </div>
      {isCloseConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-claret/70 p-4"
          role="alertdialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md rounded-2xl border border-claret/20 bg-pink p-6 text-claret shadow-2xl">
            <h2 className="text-2xl font-bold uppercase">Close Modal?</h2>
            <p className="mt-3 text-lg">{confirmCloseMessage}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCloseConfirmOpen(false)}
                className="rounded-2xl border border-claret px-4 py-3 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90"
              >
                Close Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    portal.current
  );
};

// Subcomponents
interface SectionProps {
  children: ReactNode;
}

export const ModalHead: React.FC<SectionProps> = ({ children }) => (
  <div className="mb-4 pr-12 text-2xl font-bold uppercase text-claret">{children}</div>
);

export const ModalBody: React.FC<SectionProps> = ({ children }) => (
  <div className="space-y-4 text-base md:text-lg text-claret">{children}</div>
);

export const ModalFooter: React.FC<SectionProps> = ({ children }) => (
  <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">{children}</div>
);
