import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
}

export const useProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Defensive: insert a row if trigger missed it
        const { data: inserted, error: insErr } = await supabase
          .from("profiles")
          .insert({ user_id: user.id })
          .select()
          .single();
        if (insErr) throw insErr;
        return inserted as Profile;
      }
      return data as Profile;
    },
    enabled: !!user,
  });

  const updateDisplayName = useMutation({
    mutationFn: async (displayName: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  return { profile, isLoading, updateDisplayName: updateDisplayName.mutateAsync, isUpdatingDisplayName: updateDisplayName.isPending };
};
