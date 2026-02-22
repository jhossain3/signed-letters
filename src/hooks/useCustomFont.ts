import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useMemo } from "react";

export interface GlyphRecord {
  character: string;
  stroke_data: string;
}

export function useCustomFont() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: glyphs = [], isLoading } = useQuery({
    queryKey: ["custom-font-glyphs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("custom_font_glyphs")
        .select("character, stroke_data")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as unknown as GlyphRecord[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const glyphMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of glyphs) {
      map.set(g.character, g.stroke_data);
    }
    return map;
  }, [glyphs]);

  const hasCustomFont = glyphs.length > 0;

  const saveGlyphs = useMutation({
    mutationFn: async (entries: GlyphRecord[]) => {
      if (!user) throw new Error("Not authenticated");
      // Upsert all glyphs
      const rows = entries.map((e) => ({
        user_id: user.id,
        character: e.character,
        stroke_data: e.stroke_data,
      }));
      const { error } = await (supabase as any)
        .from("custom_font_glyphs")
        .upsert(rows, { onConflict: "user_id,character" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-font-glyphs", user?.id] });
    },
  });

  const deleteAllGlyphs = useCallback(async () => {
    if (!user) return;
    await (supabase as any)
      .from("custom_font_glyphs")
      .delete()
      .eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["custom-font-glyphs", user?.id] });
  }, [user, queryClient]);

  return {
    glyphMap,
    hasCustomFont,
    isLoading,
    saveGlyphs,
    deleteAllGlyphs,
  };
}
