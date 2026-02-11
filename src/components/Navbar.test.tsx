import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Navbar from "./Navbar";

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}));

// Mock auth context
const mockSignOut = vi.fn();
let mockUser: { id: string; email: string } | null = null;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, signOut: mockSignOut }),
}));

// Mock feature flags
vi.mock("@/config/featureFlags", () => ({
  FEATURE_FLAGS: { AUTH_ENABLED: true },
}));

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );

describe("Navbar", () => {
  beforeEach(() => {
    mockUser = null;
    mockTheme = "light";
    vi.clearAllMocks();
  });

  it("renders the logo", () => {
    renderNavbar();
    // Logo component renders — just confirm navbar mounts
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  describe("Dark mode toggle", () => {
    it("toggles from light to dark", async () => {
      renderNavbar();
      const toggle = screen.getByLabelText("Toggle theme");
      await userEvent.click(toggle);
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("toggles from dark to light", async () => {
      mockTheme = "dark";
      renderNavbar();
      const toggle = screen.getByLabelText("Toggle theme");
      await userEvent.click(toggle);
      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    it("works independently of account menu", async () => {
      renderNavbar();
      const toggle = screen.getByLabelText("Toggle theme");
      await userEvent.click(toggle);
      expect(mockSetTheme).toHaveBeenCalled();
      // Menu should not be open
      expect(screen.queryByText("Write")).not.toBeInTheDocument();
    });
  });

  describe("Account dropdown menu", () => {
    it("opens on click", async () => {
      renderNavbar();
      const trigger = screen.getByLabelText("Account");
      await userEvent.click(trigger);
      expect(screen.getByText("Write")).toBeInTheDocument();
      expect(screen.getByText("My Vault")).toBeInTheDocument();
    });

    it("shows Sign in / Sign up when logged out", async () => {
      mockUser = null;
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      expect(screen.getByText("Sign in / Sign up")).toBeInTheDocument();
      expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    });

    it("shows Sign out when logged in", async () => {
      mockUser = { id: "user-1", email: "test@example.com" };
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      expect(screen.getByText("Sign out")).toBeInTheDocument();
      expect(screen.queryByText("Sign in / Sign up")).not.toBeInTheDocument();
    });

    it("always shows Write and My Vault links", async () => {
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      expect(screen.getByText("Write")).toBeInTheDocument();
      expect(screen.getByText("My Vault")).toBeInTheDocument();
    });

    it("Write link points to /write", async () => {
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      const writeLink = screen.getByText("Write").closest("a");
      expect(writeLink).toHaveAttribute("href", "/write");
    });

    it("My Vault link points to /vault", async () => {
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      const vaultLink = screen.getByText("My Vault").closest("a");
      expect(vaultLink).toHaveAttribute("href", "/vault");
    });

    it("Sign in link points to /auth", async () => {
      mockUser = null;
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      const authLink = screen.getByText("Sign in / Sign up").closest("a");
      expect(authLink).toHaveAttribute("href", "/auth");
    });

    it("calls signOut when Sign out is clicked", async () => {
      mockUser = { id: "user-1", email: "test@example.com" };
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      await userEvent.click(screen.getByText("Sign out"));
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("menu closes when selecting a link item", async () => {
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      expect(screen.getByText("Write")).toBeInTheDocument();
      await userEvent.click(screen.getByText("Write"));
      await waitFor(() => {
        expect(screen.queryByText("My Vault")).not.toBeInTheDocument();
      });
    });

    it("menu trigger is keyboard accessible", async () => {
      renderNavbar();
      const trigger = screen.getByLabelText("Account");
      trigger.focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => {
        expect(screen.getByText("Write")).toBeInTheDocument();
      });
    });

    it("menu can be closed with Escape", async () => {
      renderNavbar();
      await userEvent.click(screen.getByLabelText("Account"));
      expect(screen.getByText("Write")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByText("Write")).not.toBeInTheDocument();
      });
    });
  });
});
