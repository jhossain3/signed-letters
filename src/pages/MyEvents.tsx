import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, MapPin, Pencil, X, Check } from "lucide-react";
import { format, addDays, isWeekend, differenceInHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const UK_BANK_HOLIDAYS_2026 = [
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
  "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
];

function isBankHoliday(date: Date): boolean {
  return UK_BANK_HOLIDAYS_2026.includes(format(date, "yyyy-MM-dd"));
}

function addWorkingDays(start: Date, days: number): Date {
  let current = new Date(start);
  let added = 0;
  while (added < days) {
    current = addDays(current, 1);
    if (!isWeekend(current) && !isBankHoliday(current)) {
      added++;
    }
  }
  return current;
}

interface Submission {
  id: string;
  event_id: string;
  name: string;
  letter_date: string;
  posting_date: string;
  recipient_name: string;
  recipient_address: string;
  created_at: string;
  event_name?: string;
  event_date?: string;
  event_location?: string | null;
}

const MyEvents = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Fetch submissions
      const { data: subs, error } = await supabase
        .from("event_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // Fetch events for names
      const eventIds = [...new Set((subs || []).map((s: any) => s.event_id))];
      let eventMap: Record<string, any> = {};
      if (eventIds.length > 0) {
        // Fetch active events via public RLS
        const { data: events } = await supabase
          .from("events")
          .select("*")
          .in("id", eventIds);
        for (const e of events || []) {
          eventMap[(e as any).id] = e;
        }
      }

      const result = (subs || []).map((s: any) => ({
        ...s,
        event_name: eventMap[s.event_id]?.name || "Event",
        event_date: eventMap[s.event_id]?.event_date,
        event_location: eventMap[s.event_id]?.location,
      }));

      setSubmissions(result);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const canEdit = (postingDate: string) => {
    const posting = new Date(postingDate + "T00:00:00");
    return differenceInHours(posting, new Date()) > 48;
  };

  const startEditing = (sub: Submission) => {
    setEditingId(sub.id);
    setEditName(sub.recipient_name);
    setEditAddress(sub.recipient_address);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("event_submissions")
      .update({ recipient_name: editName, recipient_address: editAddress })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to update. Please try again.", variant: "destructive" });
    } else {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, recipient_name: editName, recipient_address: editAddress } : s))
      );
      setEditingId(null);
      toast({ title: "Updated", description: "Recipient details have been updated." });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-foreground mb-6">My Events</h1>

        {submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-body text-lg">You haven't attended any events yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => {
              const postingD = new Date(sub.posting_date + "T00:00:00");
              const arrivalEarly = addWorkingDays(postingD, 3);
              const arrivalLate = addWorkingDays(postingD, 5);
              const editable = canEdit(sub.posting_date);
              const isEditing = editingId === sub.id;

              return (
                <Card key={sub.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-display">{sub.event_name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {sub.event_date && format(new Date(sub.event_date + "T00:00:00"), "d MMMM yyyy")}
                          {sub.event_location && (
                            <>
                              <MapPin className="h-3.5 w-3.5 ml-2" />
                              {sub.event_location}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-muted-foreground">Letter date</span>
                        <p className="font-medium">{format(new Date(sub.letter_date + "T00:00:00"), "d MMM yyyy")}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Posting date</span>
                        <p className="font-medium">{format(postingD, "d MMM yyyy")}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estimated arrival</span>
                      <p className="font-medium">
                        {format(arrivalEarly, "d MMM")} – {format(arrivalLate, "d MMM yyyy")}
                      </p>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      {isEditing ? (
                        <>
                          <div>
                            <Label className="text-muted-foreground text-xs">Recipient name</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Recipient address</Label>
                            <Textarea value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="mt-1" rows={3} />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={() => saveEdit(sub.id)} disabled={saving || !editName.trim() || !editAddress.trim()}>
                              <Check className="h-4 w-4 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-muted-foreground">Recipient</span>
                            <p className="font-medium">{sub.recipient_name}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Address</span>
                            <p className="font-medium whitespace-pre-line">{sub.recipient_address}</p>
                          </div>
                          {editable ? (
                            <Button size="sm" variant="outline" onClick={() => startEditing(sub)} className="mt-2">
                              <Pencil className="h-4 w-4 mr-1" /> Edit recipient details
                            </Button>
                          ) : (
                            <p className="text-xs text-muted-foreground italic mt-2">
                              Changes can no longer be made as your posting date is approaching
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEvents;
