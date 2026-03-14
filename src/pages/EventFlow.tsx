import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TouchTooltip } from "@/components/ui/touch-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Info, Check, Mail, Eye, EyeOff } from "lucide-react";
import { format, addDays, addBusinessDays, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// UK bank holidays for 2026
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

interface EventData {
  id: string;
  name: string;
  slug: string;
  event_date: string;
  location: string | null;
  active: boolean;
}

type AuthMode = "signin" | "signup";

const EventFlow = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, session, signIn, signUp, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Auth state
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Step 2
  const [name, setName] = useState("");
  const [dob, setDob] = useState<Date | undefined>();
  const [gender, setGender] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(true);

  // Step 3
  const [letterDate, setLetterDate] = useState<Date>(new Date());
  const [postingDate, setPostingDate] = useState<Date | undefined>();

  // Step 4
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  // Fetch event
  useEffect(() => {
    if (!slug) return;
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from("events" as any)
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setEvent(data as any);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [slug]);

  // Auto-advance past auth when user signs in
  useEffect(() => {
    if (user && step === 1) {
      setStep(2);
    }
  }, [user, step]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);
    try {
      if (authMode === "signup") {
        const { error } = await signUp(email, password);
        if (error) {
          setAuthError(error.message);
        } else {
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation link. Please verify your email to continue.",
          });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) setAuthError(error.message);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!event || !user || !postingDate) return;
    setSubmitting(true);
    const { error } = await supabase.from("event_submissions" as any).insert({
      event_id: event.id,
      user_id: user.id,
      name,
      date_of_birth: dob ? format(dob, "yyyy-MM-dd") : null,
      gender: gender || null,
      marketing_consent: marketingConsent,
      letter_date: format(letterDate, "yyyy-MM-dd"),
      posting_date: format(postingDate, "yyyy-MM-dd"),
      recipient_name: recipientName,
      recipient_address: recipientAddress,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSubmitted(true);
    }
  };

  const minPostingDate = addDays(new Date(), 1);
  const arrivalEarly = postingDate ? addWorkingDays(postingDate, 3) : null;
  const arrivalLate = postingDate ? addWorkingDays(postingDate, 5) : null;

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-editorial font-semibold text-foreground">This event is no longer active</h1>
            <p className="text-muted-foreground font-body text-sm">The event you're looking for doesn't exist or has ended.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted && postingDate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-editorial font-semibold text-foreground">Your letter is sealed</h1>
              <p className="text-muted-foreground font-body">
                We'll post it on <span className="font-medium text-foreground">{format(postingDate, "d MMMM yyyy")}</span>.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-4 py-8 md:py-16">
      <div className="w-full max-w-md">
        {/* Progress */}
        {step > 1 && (
          <div className="flex gap-1.5 mb-6">
            {[2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1 — Auth */}
          {step === 1 && !user && (
            <motion.div key="step1" {...stepVariants} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader className="text-center space-y-2">
                  <p className="text-xs font-body uppercase tracking-widest text-muted-foreground">
                    {event?.event_date && format(new Date(event.event_date + "T00:00:00"), "d MMMM yyyy")}
                    {event?.location && ` · ${event.location}`}
                  </p>
                  <CardTitle className="text-2xl font-editorial">{event?.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-body">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="font-body">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {authError && (
                      <p className="text-sm text-destructive font-body">{authError}</p>
                    )}

                    <Button type="submit" className="w-full" disabled={authSubmitting}>
                      {authSubmitting ? "Please wait…" : authMode === "signup" ? "Create Account" : "Sign In"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground font-body">
                      {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline font-medium"
                        onClick={() => {
                          setAuthMode(authMode === "signup" ? "signin" : "signup");
                          setAuthError("");
                        }}
                      >
                        {authMode === "signup" ? "Sign in" : "Create one"}
                      </button>
                    </p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 2 — Event Details */}
          {step === 2 && (
            <motion.div key="step2" {...stepVariants} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-editorial">Just a couple of details for the event</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-body">Name *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-body">Date of birth</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dob && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dob ? format(dob, "PPP") : "Optional"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dob}
                          onSelect={setDob}
                          showDateInput
                          dateInputLabel="Type date"
                          disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-body">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-start gap-3 pt-2">
                    <Checkbox
                      id="marketing"
                      checked={marketingConsent}
                      onCheckedChange={(c) => setMarketingConsent(c === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="marketing" className="font-body text-sm leading-snug font-normal cursor-pointer">
                      Keep me updated with launch news, events and first dibs on new features
                    </Label>
                  </div>

                  <Button className="w-full" disabled={!name.trim()} onClick={() => setStep(3)}>
                    Continue
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 3 — Letter Details */}
          {step === 3 && (
            <motion.div key="step3" {...stepVariants} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-editorial">Letter details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-body">Date letter was written</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(letterDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={letterDate}
                          onSelect={(d) => d && setLetterDate(d)}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="font-body">Requested posting date *</Label>
                      <TouchTooltip content="We'll post your letter on the date you select via Royal Mail 2nd class. Delivery typically takes 3–5 working days but cannot be guaranteed. Plan your posting date accordingly.">
                        <span><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></span>
                      </TouchTooltip>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !postingDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {postingDate ? format(postingDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={postingDate}
                          onSelect={setPostingDate}
                          showDateInput
                          dateInputLabel="Type date"
                          disabled={(d) => d < minPostingDate}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                    <Button className="flex-1" disabled={!postingDate} onClick={() => setStep(4)}>Continue</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 4 — Recipient Details */}
          {step === 4 && (
            <motion.div key="step4" {...stepVariants} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-xl font-editorial">Recipient details</CardTitle>
                    <TouchTooltip content="Need to update the recipient name or address? You can edit these up to 48 hours before your posting date. After this point changes can no longer be made.">
                      <span><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></span>
                    </TouchTooltip>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-body">Recipient name *</Label>
                    <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Recipient address *</Label>
                    <Textarea
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder={"123 Example Street\nCity\nPostcode"}
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Back</Button>
                    <Button className="flex-1" disabled={!recipientName.trim() || !recipientAddress.trim()} onClick={() => setStep(5)}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 5 — Confirmation */}
          {step === 5 && postingDate && (
            <motion.div key="step5" {...stepVariants} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-editorial">Confirm your details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm font-body">
                    <SummaryRow label="Event" value={event?.name ?? ""} />
                    <SummaryRow label="Name" value={name} />
                    <SummaryRow label="Letter date" value={format(letterDate, "d MMMM yyyy")} />
                    <SummaryRow label="Posting date" value={format(postingDate, "d MMMM yyyy")} />
                    {arrivalEarly && arrivalLate && (
                      <SummaryRow
                        label="Estimated arrival"
                        value={`${format(arrivalEarly, "d MMM")} – ${format(arrivalLate, "d MMM yyyy")}`}
                      />
                    )}
                    <SummaryRow label="Recipient" value={recipientName} />
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground shrink-0">Address</span>
                      <span className="text-right whitespace-pre-line text-foreground">{recipientAddress}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>Back</Button>
                    <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? "Sealing…" : "Seal It"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);

export default EventFlow;
