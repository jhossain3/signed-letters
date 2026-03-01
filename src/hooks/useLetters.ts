import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { encryptLetterFields, decryptLetterFields } from "@/lib/encryption";
import { encryptLetterFieldsForRecipient, decryptLetterFieldsForRecipient } from "@/lib/emailDerivedEncryption";
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
  userId: row.user_id,
  displayTitle: row.display_title ?? undefined,
});

/**
 * Map a received letter from the recipient_* columns to the standard Letter interface.
 * Recipient columns hold email-derived encrypted content.
 */
const mapDbToReceivedLetter = (row: any): Letter => ({
  id: row.id,
  title: row.recipient_title || row.title,
  body: row.recipient_body ?? row.body,
  date: row.date,
  deliveryDate: row.delivery_date,
  signature: row.recipient_signature || row.signature,
  signatureFont: row.signature_font,
  recipientEmail: row.recipient_email,
  recipientName: row.recipient_name,
  recipientType: row.recipient_type,
  photos: row.photos || [],
  sketchData: row.recipient_sketch_data ?? row.sketch_data,
  isTyped: row.is_typed,
  createdAt: row.created_at,
  type: "received",
  paperColor: row.paper_color,
  inkColor: row.ink_color,
  isLined: row.is_lined ?? true,
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
      
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("status", "sealed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map and mark letters as sent or received based on ownership
      const mappedLetters = data.map((row: any) => {
        const isReceived = row.recipient_user_id === user.id && row.user_id !== user.id;
        if (isReceived) {
          return mapDbToReceivedLetter(row);
        }
        return mapDbToLetter(row);
      });
      
      // Decrypt letters based on type:
      // - Own sent "myself" letters: decrypt with own AES key
      // - Own sent "someone" letters: decrypt with own AES key (sender's copy)
      // - Received letters: decrypt with email-derived key
      const decryptedLetters = await Promise.all(
        mappedLetters.map(async (letter) => {
          const isReceived = letter.type === "received";

          if (isReceived) {
            // Decrypt recipient_* columns with email-derived key
            if (user.email) {
              try {
                return await decryptLetterFieldsForRecipient(letter, user.email);
              } catch (e) {
                console.error('Failed to decrypt received letter:', e);
                return letter;
              }
            }
            return letter;
          }

          // Sent letters — always decrypt with sender's AES key
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

      const isSomeoneElse = letter.recipientType === "someone";
      
      // Always encrypt with sender's key for the main columns
      const encryptedFields = await encryptLetterFields(
        { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
        user.id
      );

      const dbRow: any = {
        user_id: user.id,
        title: encryptedFields.title,
        body: encryptedFields.body,
        date: letter.date,
        delivery_date: letter.deliveryDate,
        signature: encryptedFields.signature,
        signature_font: letter.signatureFont,
        recipient_email: letter.recipientEmail,
        recipient_name: letter.recipientName,
        recipient_type: letter.recipientType,
        photos: letter.photos,
        sketch_data: encryptedFields.sketchData,
        is_typed: letter.isTyped,
        type: letter.type,
        status: "sealed",
        paper_color: letter.paperColor,
        ink_color: letter.inkColor,
        is_lined: letter.isLined ?? true,
      };

      // For "someone" letters, also encrypt with recipient's email-derived key
      if (isSomeoneElse && letter.recipientEmail) {
        dbRow.display_title = letter.title; // plaintext for sender's sent tab

        const recipientEncrypted = await encryptLetterFieldsForRecipient(
          { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
          letter.recipientEmail
        );
        dbRow.recipient_title = recipientEncrypted.title;
        dbRow.recipient_body = recipientEncrypted.body;
        dbRow.recipient_signature = recipientEncrypted.signature;
        dbRow.recipient_sketch_data = recipientEncrypted.sketchData;
      }

      let data: any;
      let error: any;

      if (letter.draftId) {
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
      if (isSomeoneElse && letter.recipientEmail) {
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
      
      // Return the mapped letter decrypted with sender's key
      const mappedLetter = mapDbToLetter(data);
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
