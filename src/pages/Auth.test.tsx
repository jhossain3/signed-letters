import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import Auth from "./Auth";

describe("Auth page redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects authenticated users to /write", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "123" } },
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith("/write", { replace: true });
  });

  it("does not redirect unauthenticated users", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
  });

  it("does not redirect authenticated users on password reset mode", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "123" } },
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/auth?mode=reset"]}>
        <Auth />
      </MemoryRouter>
    );

    expect(mockNavigate).not.toHaveBeenCalledWith("/write", { replace: true });
  });

  it("does not redirect while auth is still loading", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      isLoading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
