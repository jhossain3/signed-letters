import { useState } from "react";
import { Copy, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RecoveryCodeModalProps {
  open: boolean;
  recoveryCode: string;
  onClose: () => void;
}

const RecoveryCodeModal = ({ open, recoveryCode, onClose }: RecoveryCodeModalProps) => {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  const handleClose = () => {
    if (!saved) {
      setShowWarning(true);
      return;
    }
    onClose();
  };

  const handleForceClose = () => {
    setShowWarning(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-editorial text-xl">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Your Recovery Key
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              Save this recovery key in a safe place. You'll need it to recover your encrypted letters if you forget your password. <strong>It will never be shown again.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Recovery code display */}
            <div className="relative rounded-xl bg-muted p-4 text-center">
              <code className="font-mono text-lg md:text-xl tracking-widest text-foreground select-all break-all">
                {recoveryCode}
              </code>
            </div>

            {/* Copy button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>

            {/* Confirm checkbox */}
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-accent/50">
              <Checkbox
                checked={saved}
                onCheckedChange={(v) => setSaved(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm font-body text-foreground leading-snug">
                I have saved this recovery key somewhere safe
              </span>
            </label>

            <Button
              className="w-full"
              disabled={!saved}
              onClick={onClose}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warning dialog if they try to dismiss without saving */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-editorial">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              If you lose your password and don't have this recovery key, <strong>your encrypted letters will be permanently lost</strong>. This code will never be shown again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back and save it</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Skip anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RecoveryCodeModal;
