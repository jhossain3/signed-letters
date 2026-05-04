import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Paddle?: any;
  }
}

interface PaddleConfig {
  clientToken: string;
  sellerId: string;
  priceId: string;
  environment: "sandbox" | "production";
}

let cachedConfig: PaddleConfig | null = null;
let loadPromise: Promise<void> | null = null;

const PADDLE_SDK_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

const fetchPaddleConfig = async (): Promise<PaddleConfig> => {
  if (cachedConfig) return cachedConfig;
  const { data, error } = await supabase.functions.invoke("paddle-config");
  if (error) throw new Error(error.message);
  cachedConfig = data as PaddleConfig;
  return cachedConfig;
};

const loadPaddleSdk = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Paddle) return resolve();
    const existing = document.querySelector(`script[src="${PADDLE_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Paddle.js")));
      return;
    }
    const s = document.createElement("script");
    s.src = PADDLE_SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(s);
  });

export const usePaddle = () => {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<PaddleConfig | null>(cachedConfig);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const cfg = await fetchPaddleConfig();
        if (!mounted) return;
        setConfig(cfg);
        if (!loadPromise) loadPromise = loadPaddleSdk();
        await loadPromise;
        if (!mounted) return;
        if (window.Paddle && !window.Paddle.__initialized) {
          window.Paddle.Environment.set(cfg.environment);
          window.Paddle.Initialize({ token: cfg.clientToken });
          window.Paddle.__initialized = true;
        }
        setReady(true);
      } catch (e: any) {
        setError(e.message || "Failed to load checkout");
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  return { ready, config, error };
};
