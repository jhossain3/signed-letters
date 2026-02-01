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
  recipientType: "myself" | "someone";
  photos: string[];
  sketchData?: string;
  isTyped: boolean;
  createdAt: string;
  type: "sent" | "received";
  paperColor?: string;
  inkColor?: string;
  isLined?: boolean;
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
}

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
      
      // Decrypt all letters using user's stored encryption key
      const decryptedLetters = await Promise.all(
        mappedLetters.map(letter => decryptLetterFields(letter, user.id))
      );
      
      return decryptedLetters;
    },
    enabled: !!user,
  });

  const addLetterMutation = useMutation({
    mutationFn: async (letter: CreateLetterInput) => {
      if (!user) throw new Error("User not authenticated");

      // Only encrypt for self-sent letters
      // Letters to others remain unencrypted so recipients can read them
      const isForSelf = letter.recipientType === "myself";
      
      let titleToStore = letter.title;
      let bodyToStore = letter.body;
      let signatureToStore = letter.signature;
      let sketchDataToStore = letter.sketchData;

      if (isForSelf) {
        // Encrypt sensitive fields before saving using user's stored encryption key
        const encryptedFields = await encryptLetterFields(
          { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
          user.id
        );
        titleToStore = encryptedFields.title;
        bodyToStore = encryptedFields.body;
        signatureToStore = encryptedFields.signature;
        sketchDataToStore = encryptedFields.sketchData;
      }

      const { data, error } = await supabase
        .from("letters")
        .insert({
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
          paper_color: letter.paperColor,
          ink_color: letter.inkColor,
          is_lined: letter.isLined ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      
      // For letters to external recipients, send immediate notification
      if (!isForSelf && letter.recipientEmail) {
        try {
          const response = await supabase.functions.invoke('send-recipient-notification', {
            body: { letterId: data.id }
          });
          if (response.error) {
            console.error('Failed to send initial recipient notification:', response.error);
          } else {
            console.log('Initial recipient notification sent:', response.data);
          }
        } catch (notifyError) {
          console.error('Error sending initial recipient notification:', notifyError);
          // Don't throw - letter was saved successfully, notification is secondary
        }
      }
      
      // For self-sent, decrypt before returning; for others, just map
      const mappedLetter = mapDbToLetter(data);
      return isForSelf ? decryptLetterFields(mappedLetter, user.id) : mappedLetter;
    },
    onSuccess: (savedLetter, originalInput) => {
      queryClient.invalidateQueries({ queryKey: ["letters", user?.id] });
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
