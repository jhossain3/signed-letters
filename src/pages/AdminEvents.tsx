import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Download, Plus, CalendarDays, MapPin, Users, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isWeekend } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "yasminshahid1711@gmail.com";

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

interface EventWithCount {
  id: string;
  name: string;
  slug: string;
  event_date: string;
  location: string | null;
  active: boolean;
  submission_count: number;
}

interface SubmissionRow {
  id: string;
  name: string;
  user_email: string;
  letter_date: string;
  posting_date: string;
  recipient_name: string;
  recipient_address: string;
  marketing_consent: boolean;
  created_at: string;
  date_of_birth: string | null;
  gender: string | null;
}

const AdminEvents = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventWithCount | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [filterPostToday, setFilterPostToday] = useState(false);

  // New event form
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const invokeAdmin = async (method: "GET" | "POST", params?: Record<string, string>, body?: any) => {
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-events`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadEvents();
  }, [isAdmin]);

  const loadEvents = async () => {
    try {
      const data = await invokeAdmin("GET", { action: "list-events" });
      setEvents(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const postTodayCount = submissions.filter((s) => s.posting_date === todayStr).length;
  const displayedSubmissions = filterPostToday
    ? submissions.filter((s) => s.posting_date === todayStr)
    : submissions;

  const loadSubmissions = async (event: EventWithCount) => {
    setSelectedEvent(event);
    setSubsLoading(true);
    setFilterPostToday(false);
    try {
      const data = await invokeAdmin("GET", { action: "list-submissions", event_id: event.id });
      setSubmissions(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSubsLoading(false);
  };

  const toggleActive = async (event: EventWithCount) => {
    try {
      await invokeAdmin("POST", undefined, { action: "toggle-active", event_id: event.id, active: !event.active });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, active: !e.active } : e)));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const createEvent = async () => {
    if (!newName || !newSlug || !newDate) return;
    setCreating(true);
    try {
      const data = await invokeAdmin("POST", undefined, {
        action: "create-event",
        name: newName,
        slug: newSlug,
        event_date: newDate,
        location: newLocation || null,
      });
      setEvents((prev) => [{ ...data, submission_count: 0 }, ...prev]);
      setShowNewEvent(false);
      setNewName("");
      setNewSlug("");
      setNewDate("");
      setNewLocation("");
      toast({ title: "Event created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setCreating(false);
  };

  const exportCSV = () => {
    if (!selectedEvent || submissions.length === 0) return;
    const headers = ["Submission Date", "Name", "Email", "Letter Date", "Posting Date", "Est. Arrival (Early)", "Est. Arrival (Late)", "Recipient Name", "Recipient Address", "Marketing Consent"];
    const rows = submissions.map((s) => {
      const postingD = new Date(s.posting_date + "T00:00:00");
      const early = addWorkingDays(postingD, 3);
      const late = addWorkingDays(postingD, 5);
      return [
        format(new Date(s.created_at), "yyyy-MM-dd HH:mm"),
        s.name,
        s.user_email,
        s.letter_date,
        s.posting_date,
        format(early, "yyyy-MM-dd"),
        format(late, "yyyy-MM-dd"),
        s.recipient_name,
        `"${s.recipient_address.replace(/"/g, '""')}"`,
        s.marketing_consent ? "Yes" : "No",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedEvent.slug}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  // Submissions view
  if (selectedEvent) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => setSelectedEvent(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">{selectedEvent.name}</h1>
              <p className="text-sm text-muted-foreground">
                {format(new Date(selectedEvent.event_date + "T00:00:00"), "d MMMM yyyy")}
                {selectedEvent.location && ` · ${selectedEvent.location}`}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {postTodayCount > 0 && (
                <Button
                  variant={filterPostToday ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterPostToday(!filterPostToday)}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Post Today ({postTodayCount})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={submissions.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
          </div>

          {subsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Letter Date</TableHead>
                    <TableHead>Posting Date</TableHead>
                    <TableHead>Est. Arrival</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Marketing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedSubmissions.map((s) => {
                    const postingD = new Date(s.posting_date + "T00:00:00");
                    const early = addWorkingDays(postingD, 3);
                    const late = addWorkingDays(postingD, 5);
                    const isPostToday = s.posting_date === todayStr;
                    return (
                      <TableRow key={s.id} className={cn(isPostToday && "bg-primary/5 border-l-2 border-l-primary")}>
                        <TableCell className="whitespace-nowrap">{format(new Date(s.created_at), "d MMM yyyy")}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="text-xs">{s.user_email}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(s.letter_date + "T00:00:00"), "d MMM yyyy")}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(postingD, "d MMM yyyy")}
                          {isPostToday && <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0">Today</Badge>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{format(early, "d MMM")} – {format(late, "d MMM")}</TableCell>
                        <TableCell>{s.recipient_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.recipient_address}</TableCell>
                        <TableCell>{s.marketing_consent ? "✓" : "✗"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Events list view
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-bold">Event Admin</h1>
          <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Event name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Event" />
                </div>
                <div>
                  <Label>Slug (URL path)</Label>
                  <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="my-event" />
                </div>
                <div>
                  <Label>Event date</Label>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div>
                  <Label>Location (optional)</Label>
                  <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="London" />
                </div>
                <Button onClick={createEvent} disabled={creating || !newName || !newSlug || !newDate} className="w-full">
                  {creating ? "Creating…" : "Create Event"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No events yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Card key={event.id} className={cn(!event.active && "opacity-60")}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadSubmissions(event)}>
                    <p className="font-display font-semibold text-lg">{event.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(event.event_date + "T00:00:00"), "d MMM yyyy")}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {event.submission_count} submission{event.submission_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{event.active ? "Active" : "Inactive"}</span>
                      <Switch checked={event.active} onCheckedChange={() => toggleActive(event)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


export default AdminEvents;
