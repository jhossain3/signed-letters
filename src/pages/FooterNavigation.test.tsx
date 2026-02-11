import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import About from "./About";
import FAQ from "./FAQ";

describe("Footer navigation pages", () => {
  it("renders the About page with heading", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <About />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /about/i })).toBeInTheDocument();
  });

  it("renders the FAQ page with heading", () => {
    render(
      <MemoryRouter initialEntries={["/faq"]}>
        <FAQ />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /faq/i })).toBeInTheDocument();
  });

  it("About page has a back link to home", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <About />
      </MemoryRouter>
    );
    const backLink = screen.getByText("Back").closest("a");
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("FAQ page has a back link to home", () => {
    render(
      <MemoryRouter initialEntries={["/faq"]}>
        <FAQ />
      </MemoryRouter>
    );
    const backLink = screen.getByText("Back").closest("a");
    expect(backLink).toHaveAttribute("href", "/");
  });
});
