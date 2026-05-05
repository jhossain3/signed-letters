import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePhysicalLetter } from "@/hooks/usePhysicalLetter";
import { PHYSICAL_LETTER_CONFIG, calculatePostingDate, earliestPhysicalDeliveryDate } from "@/config/physicalLetter";
import { format } from "date-fns";
import { Loader2, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Letter content from the composer (plaintext)
  title: string;
  body: string;
  signature: string;
  deliveryDate: Date | undefined;
  recipientName: string;
  /** Called once payment completed and physical letter row marked paid. */
  onPaymentComplete: (physicalLetterId: string) => void;
}

const SendPhysicalDialog = ({
  open,
  onOpenChange,
  title,
  body,
  signature,
  deliveryDate,
  recipientName,
  onPaymentComplete,
}: Props) => {
  const { user } = useAuth();
  const { profile, updateDisplayName } = useProfile();
  const { ready, createPendingPhysicalLetter, openCheckout } = usePhysicalLetter();

  const [senderName, setSenderName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [address, setAddress] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSenderName(profile?.display_name ?? "");
      setRecipient(recipientName ?? "");
      setAcknowledged(false);
    }
  }, [open, profile?.display_name, recipientName]);

  const earliest = earliestPhysicalDeliveryDate();
  const deliveryValid = !!deliveryDate && deliveryDate >= earliest;
  const postingDate = deliveryDate ? calculatePostingDate(deliveryDate) : null;

  const canPay =
    ready &&
    !!user &&
    senderName.trim() &&
    recipient.trim() &&
    address.trim() &&
    title.trim() &&
    body.trim() &&
    signature.trim() &&
    deliveryValid &&
    acknowledged &&
    !submitting;

  const handlePay = async () => {
    if (!user?.email) return toast.error("You must be signed in");
    if (!deliveryDate) return;
    setSubmitting(true);
    try {
      // Persist display_name if changed
      if (senderName.trim() !== (profile?.display_name ?? "")) {
        await updateDisplayName(senderName.trim());
      }

      const row = await createPendingPhysicalLetter({
        letterId: null,
        senderName: senderName.trim(),
        recipientName: recipient.trim(),
        recipientAddress: address.trim(),
        plaintextTitle: title,
        plaintextBody: body,
        plaintextSignature: signature,
        deliveryDate,
      });

      openCheckout(
        row.id,
        user.email,
        () => {
          toast.success("Payment received — your letter is queued for posting.");
          onPaymentComplete(row.id);
          onOpenChange(false);
        },
        () => {
          setSubmitting(false);
        },
      );
    } catch (e: any) {
      toast.error(e.message || "Could not start checkout");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-editorial text-2xl">Send a physical letter</DialogTitle>
          <DialogDescription>
            We'll print and post your letter via Royal Mail so it arrives around your chosen delivery date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Your name (as it should appear on the letter)</Label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="e.g. Alex Morgan" />
            <p className="text-xs text-muted-foreground mt-1">Saved to your profile for next time.</p>
          </div>

          <div>
            <Label>Recipient name</Label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Their full name" />
          </div>

          <div>
            <Label>Postal address</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={"123 Example Street\nLondon\nSW1A 1AA\nUnited Kingdom"}
              rows={5}
            />
          </div>

          {!deliveryValid && (
            <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Choose a delivery date at least {PHYSICAL_LETTER_CONFIG.MIN_DELIVERY_LEAD_DAYS} days from today
                (earliest: {format(earliest, "MMM d, yyyy")}).
              </span>
            </div>
          )}

          {deliveryDate && deliveryValid && postingDate && (
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
              We'll post by <strong>{format(postingDate, "MMM d, yyyy")}</strong> for delivery around{" "}
              <strong>{format(deliveryDate, "MMM d, yyyy")}</strong>.
            </div>
          )}

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1"
            />
            <span className="text-muted-foreground">
              I understand that to print and post this letter, our team will be able to read its contents. End-to-end
              encryption only applies to digital sealed notes.
            </span>
          </label>

          <Button onClick={handlePay} disabled={!canPay} size="lg" className="w-full rounded-full">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening checkout…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" /> Pay {PHYSICAL_LETTER_CONFIG.PRICE_DISPLAY} & send
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">Secure payment by Paddle.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendPhysicalDialog;
