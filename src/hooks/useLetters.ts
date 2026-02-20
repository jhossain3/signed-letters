import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { encryptLetterFields, decryptLetterFields } from "@/lib/encryption";
import {
  getCachedRsaPrivateKey,
  getCachedRsaPublicKey,
  fetchRecipientRsaPublicKey,
  envelopeEncryptLetter,
  envelopeDecryptLetter,
} from "@/lib/rsaEncryption";
import { FEATURE_FLAGS } from "@/config/featureFlags";

// Trigger immediate notification for same-day self-sent letters
// Pass the plaintext title since the stored title is encrypted
const triggerImmediateNotification = async (letterId: string, plaintextTitle: string) => {
  console.log('[triggerImmediateNotification] Invoking send-letter-notifications with plaintext title...');
  try {
    const response = await supabase.functions.invoke('send-letter-notifications', {
      body: { letterId, plaintextTitle }
    });
    if (response.error) {
      console.error('[triggerImmediateNotification] Failed:', response.error);
    } else {
      console.log('[triggerImmediateNotification] Success:', response.data);
    }
  } catch (error) {
    console.error('[triggerImmediateNotification] Error:', error);
  }
};

export interface Letter {
  id: string;
  title: string;
  body: string | null;
  date: string;
  deliveryDate: string;
  signature: string;
  signatureFont?: string;
  recipientEmail?: string;
  recipientType: "myself" | "someone";
  photos: string[];
  sketchData?: string;
  isTyped: boolean;
  createdAt: string;
  type: "sent" | "received";
  paperColor?: string;
  inkColor?: string;
  isLined?: boolean;
  recipientEncrypted?: boolean;
  userId?: string;
  displayTitle?: string;
  senderWrappedContentKey?: string;
  recipientWrappedContentKey?: string;
}

export interface CreateLetterInput {
  title: string;
  body: string;
  date: string;
  deliveryDate: string;
  signature: string;
  signatureFont?: string;
  recipientEmail?: string;
  recipientType: "myself" | "someone";
  photos: string[];
  sketchData?: string;
  isTyped: boolean;
  type: "sent" | "received";
  paperColor?: string;
  inkColor?: string;
  isLined?: boolean;
  draftId?: string;
}

// Resolve photo paths to signed URLs
// Photos stored as storage paths (e.g. "userId/uuid.jpg") get signed URLs
// Legacy base64 photos and full URLs are passed through as-is
const resolvePhotoUrls = async (photos: string[]): Promise<string[]> => {
  if (!photos || photos.length === 0) return [];
  
  const resolved = await Promise.all(
    photos.map(async (photo) => {
      if (photo.startsWith("data:") || photo.startsWith("http")) return photo;
      const { data, error } = await supabase.storage
        .from("letter-photos")
        .createSignedUrl(photo, 3600);
      if (error || !data?.signedUrl) {
        console.error("Failed to create signed URL for photo:", photo, error);
        return "";
      }
      return data.signedUrl;
    })
  );
  return resolved.filter(Boolean);
};

const mapDbToLetter = (row: any): Letter => ({
  id: row.id,
  title: row.title,
  body: row.body,
  date: row.date,
  deliveryDate: row.delivery_date,
  signature: row.signature,
  signatureFont: row.signature_font,
  recipientEmail: row.recipient_email,
  recipientType: row.recipient_type,
  photos: row.photos || [],
  sketchData: row.sketch_data,
  isTyped: row.is_typed,
  createdAt: row.created_at,
  type: row.type,
  paperColor: row.paper_color,
  inkColor: row.ink_color,
  isLined: row.is_lined ?? true,
  recipientEncrypted: row.recipient_encrypted ?? false,
  userId: row.user_id,
  displayTitle: row.display_title ?? undefined,
  senderWrappedContentKey: row.sender_wrapped_content_key ?? undefined,
  recipientWrappedContentKey: row.recipient_wrapped_content_key ?? undefined,
});

export const useLetters = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: letters = [], isLoading, error } = useQuery({
    queryKey: ["letters", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("status", "sealed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const mappedLetters = data.map((row: any) => {
        const letter = mapDbToLetter(row);
        if (row.recipient_user_id === user.id && row.user_id !== user.id) {
          return { ...letter, type: "received" as const };
        }
        return letter;
      });
      
      const rsaPrivateKey = getCachedRsaPrivateKey();

      const decryptedLetters = await Promise.all(
        mappedLetters.map(async (letter) => {
          const isReceived = letter.type === "received";
          const isSentToSomeone = letter.recipientType === "someone" && !isReceived;

          // ── New envelope-encrypted letters (RSA flow) ──
          if (letter.senderWrappedContentKey && letter.recipientWrappedContentKey) {
            if (!rsaPrivateKey) {
              // RSA keys not in cache — show placeholder
              return {
                ...letter,
                title: letter.displayTitle || "Encrypted letter",
                body: "Sign out and sign back in to read this letter.",
                signature: "🔒",
              };
            }

            try {
              const wrappedKey = isReceived
                ? letter.recipientWrappedContentKey
                : letter.senderWrappedContentKey;
              return await envelopeDecryptLetter(letter, wrappedKey, rsaPrivateKey);
            } catch (err) {
              console.error("[Letters] Envelope decryption failed:", err);
              return {
                ...letter,
                title: letter.displayTitle || "Encrypted letter",
                body: "[Unable to decrypt]",
                signature: "🔒",
              };
            }
          }

          // ── Legacy flow (AES master key) ──
          if (isReceived) {
            if (letter.recipientEncrypted) {
              return decryptLetterFields(letter, user.id);
            }
            // Not yet re-encrypted — show placeholder with display_title
            return Promise.resolve({
              ...letter,
              title: letter.displayTitle || "A letter for you",
              body: null,
              signature: "",
            });
          }

          if (isSentToSomeone && letter.recipientEncrypted) {
            return Promise.resolve({
              ...letter,
              title: letter.displayTitle || "A letter",
              body: "This letter has been securely transferred to your recipient.",
              signature: "✓ Delivered",
            });
          }

          return decryptLetterFields(letter, user.id);
        })
      );
      
      const withResolvedPhotos = await Promise.all(
        decryptedLetters.map(async (letter) => ({
          ...letter,
          photos: await resolvePhotoUrls(letter.photos),
        }))
      );
      
      return withResolvedPhotos;
    },
    enabled: !!user,
  });

  const addLetterMutation = useMutation({
    mutationFn: async (letter: CreateLetterInput) => {
      if (!user) throw new Error("User not authenticated");

      let titleToStore: string;
      let bodyToStore: string | null;
      let signatureToStore: string;
      let sketchDataToStore: string | undefined;
      let senderWrappedContentKey: string | undefined;
      let recipientWrappedContentKey: string | undefined;

      const isSendingToSomeone = letter.recipientType === "someone" && letter.recipientEmail;

      if (isSendingToSomeone) {
        // Try envelope encryption (RSA flow)
        const senderRsaPub = getCachedRsaPublicKey();
        const recipientRsaPub = letter.recipientEmail
          ? await fetchRecipientRsaPublicKey(letter.recipientEmail)
          : null;

        if (senderRsaPub && recipientRsaPub) {
          // Both parties have RSA keys — use envelope encryption
          const envelope = await envelopeEncryptLetter(
            { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
            senderRsaPub,
            recipientRsaPub
          );
          titleToStore = envelope.title;
          bodyToStore = envelope.body;
          signatureToStore = envelope.signature;
          sketchDataToStore = envelope.sketchData;
          senderWrappedContentKey = envelope.senderWrappedContentKey;
          recipientWrappedContentKey = envelope.recipientWrappedContentKey;
        } else {
          // Fallback: encrypt with sender's AES key (pending re-encryption)
          // Recipient doesn't have RSA keys yet — letter will be re-encrypted
          // client-side when sender logs in and recipient has keys
          const encryptedFields = await encryptLetterFields(
            { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
            user.id
          );
          titleToStore = encryptedFields.title;
          bodyToStore = encryptedFields.body;
          signatureToStore = encryptedFields.signature;
          sketchDataToStore = encryptedFields.sketchData;

          if (!recipientRsaPub && senderRsaPub) {
            toast.info("Your recipient hasn't enabled encrypted receiving yet. The letter will be securely delivered once they log in.");
          }
        }
      } else {
        // Self-sent: use existing AES master key encryption
        const encryptedFields = await encryptLetterFields(
          { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
          user.id
        );
        titleToStore = encryptedFields.title;
        bodyToStore = encryptedFields.body;
        signatureToStore = encryptedFields.signature;
        sketchDataToStore = encryptedFields.sketchData;
      }

      const dbRow: any = {
        user_id: user.id,
        title: titleToStore,
        body: bodyToStore,
        date: letter.date,
        delivery_date: letter.deliveryDate,
        signature: signatureToStore,
        signature_font: letter.signatureFont,
        recipient_email: letter.recipientEmail,
        recipient_type: letter.recipientType,
        photos: letter.photos,
        sketch_data: sketchDataToStore,
        is_typed: letter.isTyped,
        type: letter.type,
        status: "sealed",
        paper_color: letter.paperColor,
        ink_color: letter.inkColor,
        is_lined: letter.isLined ?? true,
      };

      if (letter.recipientType === "someone") {
        dbRow.display_title = letter.title;
      }

      // Add envelope encryption keys if present
      if (senderWrappedContentKey) {
        dbRow.sender_wrapped_content_key = senderWrappedContentKey;
        dbRow.recipient_wrapped_content_key = recipientWrappedContentKey;
        // Mark as recipient_encrypted since both parties can decrypt immediately
        dbRow.recipient_encrypted = true;
      }

      let data: any;
      let dbError: any;

      if (letter.draftId) {
        const result = await supabase
          .from("letters")
          .update(dbRow)
          .eq("id", letter.draftId)
          .eq("user_id", user.id)
          .select()
          .single();
        data = result.data;
        dbError = result.error;
      } else {
        const result = await supabase
          .from("letters")
          .insert(dbRow)
          .select()
          .single();
        data = result.data;
        dbError = result.error;
      }

      if (dbError) throw dbError;
      
      // For letters to external recipients, check if they already have an account
      if (letter.recipientType === "someone" && letter.recipientEmail) {
        try {
          const { data: existingUserId } = await supabase.rpc('find_user_by_email', {
            lookup_email: letter.recipientEmail,
          });
          if (existingUserId) {
            console.log('[addLetter] Recipient already exists, linking letter:', existingUserId);
            await supabase
              .from("letters")
              .update({ recipient_user_id: existingUserId })
              .eq("id", data.id);
            data.recipient_user_id = existingUserId;
          }
        } catch (lookupError) {
          console.error('Error looking up existing recipient:', lookupError);
        }

        // Send initial notification to recipient
        try {
          const response = await supabase.functions.invoke('send-recipient-notification', {
            body: { letterId: data.id, plaintextTitle: letter.title }
          });
          if (response.error) {
            console.error('Failed to send initial recipient notification:', response.error);
          } else {
            console.log('Initial recipient notification sent:', response.data);
          }
        } catch (notifyError) {
          console.error('Error sending initial recipient notification:', notifyError);
        }
      }
      
      // Return decrypted letter for UI
      const mappedLetter = mapDbToLetter(data);

      // If envelope-encrypted, decrypt with sender's RSA key
      if (senderWrappedContentKey) {
        const rsaPrivateKey = getCachedRsaPrivateKey();
        if (rsaPrivateKey) {
          return envelopeDecryptLetter(mappedLetter, senderWrappedContentKey, rsaPrivateKey);
        }
      }

      return decryptLetterFields(mappedLetter, user.id);
    },
    onSuccess: (savedLetter, originalInput) => {
      queryClient.invalidateQueries({ queryKey: ["letters", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["drafts", user?.id] });
      toast.success("Letter sealed and saved!");
      
      const deliveryDate = new Date(savedLetter.deliveryDate);
      const today = new Date();
      deliveryDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      const isSameDay = deliveryDate.getTime() === today.getTime();
      const isSelfSent = savedLetter.recipientType === "myself";
      
      if (isSameDay && isSelfSent) {
        console.log('[addLetterMutation] Same-day self-sent letter detected, triggering immediate notification');
        triggerImmediateNotification(savedLetter.id, originalInput.title);
      }
    },
    onError: (error) => {
      toast.error("Failed to save letter: " + error.message);
    },
  });

  const isLetterOpenable = (letter: Letter) => {
    const deliveryDate = new Date(letter.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= deliveryDate;
  };

  return {
    letters,
    isLoading,
    error,
    addLetter: addLetterMutation.mutateAsync,
    isAddingLetter: addLetterMutation.isPending,
    isLetterOpenable,
  };
};
