import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Trash2 } from "lucide-react";

type DeleteConfirmationModalProps = {
  open: boolean;
  onClose: () => void;
  itemName: string;
  itemType: string;
  onConfirm?: () => Promise<void> | void;
};

export default function DeleteConfirmationModal({
  open,
  onClose,
  itemName,
  itemType,
  onConfirm,
}: DeleteConfirmationModalProps) {
  if (!open) return null;

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Delete {itemType}</ModalHead>
      <ModalBody>
        <div className="text-center flex flex-col gap-4">
            {itemType === 'weight entry' ? (
              <p className="text-xl md:text-lg">You are about to delete this weight entry.</p>
            ) : (
              <p className="text-xl md:text-lg">You are about to delete <span className="font-bold uppercase">{itemName}</span>.</p>
            )}
            <p className="text-xl md:text-2xl uppercase tracking-wider font-black">This action cannot be undone.</p>
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={async () => {
            if (onConfirm) await onConfirm()
            onClose()
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-pink px-6 py-3 text-sm uppercase tracking-widest text-claret hover:bg-claret hover:text-pink max-w-[60%] mx-auto"
        >
          <Trash2 className="size-4" />
          Confirm Delete
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}
