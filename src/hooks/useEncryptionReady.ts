import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { initializeUserEncryptionKey } from "@/lib/encryption";

/**
 * Hook that checks whether the encryption system is ready for the current user.
 * Returns { isReady, isInitializing, error } so the UI can disable submission
 * until encryption is confirmed available.
 */
export function useEncryptionReady() {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsReady(false);
      setIsInitializing(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsInitializing(true);
    setError(null);

    initializeUserEncryptionKey(user.id).then((success) => {
      if (cancelled) return;
      setIsInitializing(false);
      if (success) {
        setIsReady(true);
      } else {
        setError("Unable to set up secure storage. Please try refreshing the page.");
      }
    });

    return () => { cancelled = true; };
  }, [user]);

  return { isReady, isInitializing, error };
}
