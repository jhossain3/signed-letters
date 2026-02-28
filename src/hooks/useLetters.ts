import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { encryptLetterFields, decryptLetterFields } from "@/lib/encryption";
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
  recipientName?: string;
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
}

export interface CreateLetterInput {
  title: string;
  body: string;
  date: string;
  deliveryDate: string;
  signature: string;
  signatureFont?: string;
  recipientEmail?: string;
  recipientName?: string;
  recipientType: "myself" | "someone";
  photos: string[];
  sketchData?: string;
  isTyped: boolean;
  type: "sent" | "received";
  paperColor?: string;
  inkColor?: string;
  isLined?: boolean;
  draftId?: string; // If sealing from a draft, update instead of insert
}

// Resolve photo paths to signed URLs
// Photos stored as storage paths (e.g. "userId/uuid.jpg") get signed URLs
// Legacy base64 photos and full URLs are passed through as-is
const resolvePhotoUrls = async (photos: string[]): Promise<string[]> => {
  if (!photos || photos.length === 0) return [];
  
  const resolved = await Promise.all(
    photos.map(async (photo) => {
      // Skip base64 data URLs and full URLs (legacy data)
      if (photo.startsWith("data:") || photo.startsWith("http")) return photo;
      // It's a storage path — create a signed URL (1 hour expiry)
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
  recipientName: row.recipient_name,
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
});

export const useLetters = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: letters = [], isLoading, error } = useQuery({
    queryKey: ["letters", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Fetch letters authored by user OR received by user
      // RLS policy handles this, but we need to get all accessible letters
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("status", "sealed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map and mark letters as sent or received based on ownership
      const mappedLetters = data.map((row: any) => {
        const letter = mapDbToLetter(row);
        // If user is the recipient (not the author), mark as received
        if (row.recipient_user_id === user.id && row.user_id !== user.id) {
          return { ...letter, type: "received" as const };
        }
        return letter;
      });
      
      // Decrypt letters:
      // - Own sent letters (recipient_type=myself): decrypt with own key
      // - Own sent letters (recipient_type=someone, recipient_encrypted=false): decrypt with own key (still encrypted with sender's key)
      // - Own sent letters (recipient_type=someone, recipient_encrypted=true): already re-encrypted for recipient, sender can't decrypt — show placeholder
      // - Received letters (recipient_encrypted=true): decrypt with own key
      // - Received letters (recipient_encrypted=false): not yet re-encrypted, show "not ready"
      const decryptedLetters = await Promise.all(
        mappedLetters.map(letter => {
          const isReceived = letter.type === "received";
          const isSentToSomeone = letter.recipientType === "someone" && !isReceived;

          if (isReceived) {
            // "someone" letters are stored as plaintext — no decryption needed
            return Promise.resolve(letter);
          }

          if (isSentToSomeone) {
            // "someone" letters are stored as plaintext — no decryption needed
            return Promise.resolve(letter);
          }

          // Own letter (self) — decrypt with own key
          return decryptLetterFields(letter, user.id);
        })
      );
      
      // Resolve storage paths to signed URLs for photos
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

      // For "someone" letters, store plaintext (no encryption)
      // For "myself" letters, encrypt with sender's key
      const isSomeoneElse = letter.recipientType === "someone";
      
      let titleToStore: string;
      let bodyToStore: string | null;
      let signatureToStore: string;
      let sketchDataToStore: string | undefined;

      if (isSomeoneElse) {
        // Store plaintext for "someone" letters
        titleToStore = letter.title;
        bodyToStore = letter.body;
        signatureToStore = letter.signature;
        sketchDataToStore = letter.sketchData;
      } else {
        // Encrypt for "myself" letters
        const encryptedFields = await encryptLetterFields(
          { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
          user.id
        );
        titleToStore = encryptedFields.title;
        bodyToStore = encryptedFields.body;
        signatureToStore = encryptedFields.signature;
        sketchDataToStore = encryptedFields.sketchData;
      }

      // If sealing from a draft, update the existing row; otherwise insert new
      const dbRow: any = {
        user_id: user.id,
        title: titleToStore,
        body: bodyToStore,
        date: letter.date,
        delivery_date: letter.deliveryDate,
        signature: signatureToStore,
        signature_font: letter.signatureFont,
        recipient_email: letter.recipientEmail,
        recipient_name: letter.recipientName,
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

      // For "someone" letters, save plaintext title for display
      if (isSomeoneElse) {
        dbRow.display_title = letter.title;
      }

      let data: any;
      let error: any;

      if (letter.draftId) {
        // Seal an existing draft
        const result = await supabase
          .from("letters")
          .update(dbRow)
          .eq("id", letter.draftId)
          .eq("user_id", user.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from("letters")
          .insert(dbRow)
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      
      // For letters to external recipients, check if they already have an account
      // The link_pending_letters trigger only fires on NEW signups, so we handle existing users here
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
      
      // For "someone" letters, content is plaintext — no decryption needed
      // For "myself" letters, decrypt with sender key
      const mappedLetter = mapDbToLetter(data);
      if (letter.recipientType === "someone") {
        return mappedLetter;
      }
      return decryptLetterFields(mappedLetter, user.id);
    },
    onSuccess: (savedLetter, originalInput) => {
      queryClient.invalidateQueries({ queryKey: ["letters", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["drafts", user?.id] });
      toast.success("Letter sealed and saved!");
      
      // For self-sent same-day letters, trigger immediate notification
      const deliveryDate = new Date(savedLetter.deliveryDate);
      const today = new Date();
      deliveryDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      const isSameDay = deliveryDate.getTime() === today.getTime();
      const isSelfSent = savedLetter.recipientType === "myself";
      
      if (isSameDay && isSelfSent) {
        console.log('[addLetterMutation] Same-day self-sent letter detected, triggering immediate notification');
        // Pass the plaintext title from the original input (before encryption)
        triggerImmediateNotification(savedLetter.id, originalInput.title);
      }
      
      // For "someone" letters, also pass plaintext title since content is now encrypted
      if (savedLetter.recipientType === "someone" && !isSameDay) {
        // The send-letter-notifications cron will handle delivery-date notifications
        // but we already passed plaintext title during the initial notification above
      }
    },
    onError: (error) => {
      toast.error("Failed to save letter: " + error.message);
    },
  });

  const isLetterOpenable = (letter: Letter) => {
    // Always check delivery date - letters can only be opened on or after their delivery date
    // The BYPASS_DELIVERY_DATE flag only controls whether users can SELECT today's date when sealing,
    // not whether letters can be opened early
    const deliveryDate = new Date(letter.deliveryDate);
    // Allow opening on the same day (compare dates only, not time)
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
