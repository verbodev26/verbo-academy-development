import { X } from "lucide-react";
import { GhostButton, PrimaryButton } from "./ui";

export function ConfirmAvailabilityModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div onClick={onCancel} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-floating"
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">Confirm Your Availability</h3>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-foreground">
          <li>Any new student, group, or substitution request within your available hours may be assigned directly. No approval needed from you.</li>
          <li>Requests outside your available hours will only be assigned if you agree.</li>
          <li>Your schedule is permanent once confirmed and can only be changed with prior Admin approval.</li>
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <PrimaryButton onClick={onConfirm}>Confirm Availability</PrimaryButton>
        </div>
      </div>
    </div>
  );
}