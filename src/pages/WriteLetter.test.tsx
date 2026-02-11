import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Track navigation calls
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock auth
let mockUser: { id: string } | null = null;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock encryption hook
vi.mock("@/hooks/useEncryptionReady", () => ({
  useEncryptionReady: () => ({ isReady: true, isInitializing: false, error: null }),
}));

// Mock useLetters
const mockAddLetter = vi.fn().mockResolvedValue({ id: "new-letter-id" });
vi.mock("@/hooks/useLetters", () => ({
  useLetters: () => ({ addLetter: mockAddLetter, isAddingLetter: false }),
}));

// Mock feature flags — auth enabled
vi.mock("@/config/featureFlags", () => ({
  FEATURE_FLAGS: { AUTH_ENABLED: true, BYPASS_DELIVERY_DATE: false },
}));

// Mock sonner
const mockToast = { error: vi.fn(), info: vi.fn(), success: vi.fn() };
vi.mock("sonner", () => ({ toast: mockToast }));

// Mock sketch serialization
vi.mock("@/lib/sketchSerialization", () => ({
  serializeMultiPage: () => "[]",
}));

// We need to lazy-import WriteLetter so mocks are set up first
const renderWriteLetter = async () => {
  const { default: WriteLetter } = await import("./WriteLetter");
  return render(
    <MemoryRouter>
      <WriteLetter />
    </MemoryRouter>
  );
};

describe("WriteLetter — seal auth gate", () => {
  beforeEach(() => {
    mockUser = null;
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("redirects unauthenticated user to /auth when sealing", async () => {
    await renderWriteLetter();

    // The seal button should exist
    const sealButton = screen.getByRole("button", { name: /seal/i });
    await userEvent.click(sealButton);

    // Should navigate to auth with return path
    expect(mockNavigate).toHaveBeenCalledWith("/auth", {
      state: { from: { pathname: "/write" } },
    });
    expect(mockToast.info).toHaveBeenCalledWith("Please sign in to seal");
  });

  it("saves draft to localStorage before auth redirect", async () => {
    await renderWriteLetter();

    // Type a title first
    const titleInput = screen.getByPlaceholderText(/title/i);
    await userEvent.type(titleInput, "My Future Note");

    const sealButton = screen.getByRole("button", { name: /seal/i });
    await userEvent.click(sealButton);

    // Draft should be saved
    const savedDraft = localStorage.getItem("letter-draft");
    expect(savedDraft).not.toBeNull();
    const draft = JSON.parse(savedDraft!);
    expect(draft.title).toBe("My Future Note");
  });

  it("shows validation errors for authenticated user with missing fields", async () => {
    mockUser = { id: "user-1" };
    await renderWriteLetter();

    const sealButton = screen.getByRole("button", { name: /seal/i });
    await userEvent.click(sealButton);

    // Should show validation error (missing title), not redirect
    expect(mockToast.error).toHaveBeenCalledWith("Please add a title");
    expect(mockNavigate).not.toHaveBeenCalledWith("/auth", expect.anything());
  });
});
