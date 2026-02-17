import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Draft {
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
  updatedAt: string;
  paperColor?: string;
  inkColor?: string;
  isLined?: boolean;
}

const mapDbToDraft = (row: any): Draft => ({
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
  updatedAt: row.updated_at,
  paperColor: row.paper_color,
  inkColor: row.ink_color,
  isLined: row.is_lined ?? true,
});

export interface SaveDraftInput {
  id?: string; // If provided, upsert
  title: string;
  body: string;
  date: string;
  deliveryDate?: string;
  signature: string;
  signatureFont?: string;
  recipientEmail?: string;
  recipientType: "myself" | "someone";
  photos: string[];
  sketchData?: string;
  isTyped: boolean;
  paperColor?: string;
  inkColor?: string;
  isLined?: boolean;
}

export const useDrafts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["drafts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data.map(mapDbToDraft);
    },
    enabled: !!user,
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (input: SaveDraftInput) => {
      if (!user) throw new Error("User not authenticated");

      const row = {
        user_id: user.id,
        title: input.title || "Untitled Letter",
        body: input.body,
        date: input.date,
        delivery_date: input.deliveryDate || new Date().toISOString(),
        signature: input.signature || "",
        signature_font: input.signatureFont,
        recipient_email: input.recipientEmail,
        recipient_type: input.recipientType,
        photos: input.photos,
        sketch_data: input.sketchData,
        is_typed: input.isTyped,
        type: "sent" as const,
        status: "draft",
        paper_color: input.paperColor,
        ink_color: input.inkColor,
        is_lined: input.isLined ?? true,
      };

      if (input.id) {
        // Upsert: update existing draft
        const { data, error } = await supabase
          .from("letters")
          .update(row)
          .eq("id", input.id)
          .eq("user_id", user.id)
          .eq("status", "draft")
          .select()
          .single();
        if (error) throw error;
        return mapDbToDraft(data);
      } else {
        // Insert new draft
        const { data, error } = await supabase
          .from("letters")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        return mapDbToDraft(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts", user?.id] });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("letters")
        .delete()
        .eq("id", draftId)
        .eq("user_id", user.id)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts", user?.id] });
      toast.success("Draft deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete draft: " + error.message);
    },
  });

  return {
    drafts,
    isLoading,
    saveDraft: saveDraftMutation.mutateAsync,
    isSavingDraft: saveDraftMutation.isPending,
    deleteDraft: deleteDraftMutation.mutateAsync,
    isDeletingDraft: deleteDraftMutation.isPending,
  };
};
