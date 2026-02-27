import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import Index from "./pages/Index";
import WriteLetter from "./pages/WriteLetter";
import Vault from "./pages/Vault";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Auth from "./pages/Auth";
import Drafts from "./pages/Drafts";
import NotFound from "./pages/NotFound";
import Navbar from "./components/Navbar";
import InstallPrompt from "./components/InstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Navbar />
            <div className="pt-16">
              <Routes>
                <Route path="/" element={<Index />} />
                {FEATURE_FLAGS.AUTH_ENABLED && (
                  <Route path="/auth" element={<Auth />} />
                )}
                <Route path="/write" element={<WriteLetter />} />
                <Route path="/about" element={<About />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route
                  path="/drafts"
                  element={
                    FEATURE_FLAGS.AUTH_ENABLED ? (
                      <ProtectedRoute>
                        <Drafts />
                      </ProtectedRoute>
                    ) : (
                      <Drafts />
                    )
                  }
                />
                <Route
                  path="/vault"
                  element={
                    FEATURE_FLAGS.AUTH_ENABLED ? (
                      <ProtectedRoute>
                        <Vault />
                      </ProtectedRoute>
                    ) : (
                      <Vault />
                    )
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <InstallPrompt />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
