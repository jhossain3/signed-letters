import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { encryptLetterFields, decryptLetterFields } from "@/lib/encryption";
import { FEATURE_FLAGS } from "@/config/featureFlags";

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
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Decrypt all letters
      const mappedLetters = data.map(mapDbToLetter);
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

      // Encrypt sensitive fields before saving (including sketch data)
      const encryptedFields = await encryptLetterFields(
        { title: letter.title, body: letter.body, signature: letter.signature, sketchData: letter.sketchData },
        user.id
      );

      const { data, error } = await supabase
        .from("letters")
        .insert({
          user_id: user.id,
          title: encryptedFields.title,
          body: encryptedFields.body,
          date: letter.date,
          delivery_date: letter.deliveryDate,
          signature: encryptedFields.signature,
          signature_font: letter.signatureFont,
          recipient_email: letter.recipientEmail,
          recipient_type: letter.recipientType,
          photos: letter.photos,
          sketch_data: encryptedFields.sketchData,
          is_typed: letter.isTyped,
          type: letter.type,
          paper_color: letter.paperColor,
          ink_color: letter.inkColor,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Decrypt before returning
      const mappedLetter = mapDbToLetter(data);
      return decryptLetterFields(mappedLetter, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letters", user?.id] });
      toast.success("Letter sealed and saved!");
    },
    onError: (error) => {
      toast.error("Failed to save letter: " + error.message);
    },
  });

  const isLetterOpenable = (letter: Letter) => {
    // Bypass delivery date check for testing
    if (FEATURE_FLAGS.BYPASS_DELIVERY_DATE) {
      return true;
    }
    
    const deliveryDate = new Date(letter.deliveryDate);
    const now = new Date();
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
