import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const AVATAR_OPTIONS = [
  { id: "initials", label: "Initials", icon: null },
  { id: "cat", label: "Cat", emoji: "🐱" },
  { id: "dog", label: "Dog", emoji: "🐶" },
  { id: "fox", label: "Fox", emoji: "🦊" },
  { id: "owl", label: "Owl", emoji: "🦉" },
  { id: "bear", label: "Bear", emoji: "🐻" },
  { id: "butterfly", label: "Butterfly", emoji: "🦋" },
  { id: "flower", label: "Flower", emoji: "🌸" },
  { id: "star", label: "Star", emoji: "⭐" },
  { id: "heart", label: "Heart", emoji: "💜" },
  { id: "moon", label: "Moon", emoji: "🌙" },
  { id: "sun", label: "Sun", emoji: "☀️" },
];

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentAvatar = user?.user_metadata?.avatar || "initials";
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const userEmail = user?.email || "";
  const userInitials = userEmail
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  const handleSaveAvatar = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar: selectedAvatar },
      });
      if (error) throw error;
      toast({ title: "Avatar updated", description: "Your profile icon has been saved." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || "Deletion failed");

      await signOut();
      navigate("/");
      toast({ title: "Account deleted", description: "Your account and all data have been permanently removed." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsDeleting(false);
    }
  };

  const renderAvatarPreview = (avatarId: string, size: "sm" | "lg" = "sm") => {
    const option = AVATAR_OPTIONS.find((o) => o.id === avatarId);
    const sizeClasses = size === "lg" ? "h-20 w-20 text-3xl" : "h-12 w-12 text-lg";

    if (avatarId === "initials") {
      return (
        <div className={`${sizeClasses} rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold font-serif`}>
          {userInitials}
        </div>
      );
    }

    return (
      <div className={`${sizeClasses} rounded-full bg-accent flex items-center justify-center`}>
        {option?.emoji}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Profile</h1>
        </div>

        {/* Avatar Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Profile Icon</CardTitle>
            <CardDescription>Choose an avatar that represents you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              {renderAvatarPreview(selectedAvatar, "lg")}
              <div>
                <p className="font-medium text-foreground">
                  {AVATAR_OPTIONS.find((o) => o.id === selectedAvatar)?.label || "Initials"}
                </p>
                <p className="text-sm text-muted-foreground">Your current avatar</p>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-6">
              {AVATAR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedAvatar(option.id)}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                    selectedAvatar === option.id
                      ? "border-primary bg-accent shadow-sm"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                >
                  {renderAvatarPreview(option.id)}
                  <span className="text-xs text-muted-foreground mt-1">{option.label}</span>
                  {selectedAvatar === option.id && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <Button
              onClick={handleSaveAvatar}
              disabled={isSaving || selectedAvatar === currentAvatar}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Avatar"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Email Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Email Address</CardTitle>
            <CardDescription>Your account email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground font-mono text-sm select-all">{userEmail}</span>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Separator className="my-8" />

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="font-serif text-lg text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    "Delete Account"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your letters and data and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
