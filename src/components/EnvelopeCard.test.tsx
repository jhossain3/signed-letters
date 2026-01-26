import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import EnvelopeCard from "./EnvelopeCard";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, onHoverStart, onHoverEnd, onClick, className, ...props }: any) => (
      <div
        className={className}
        onClick={onClick}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        data-testid="envelope-container"
        {...props}
      >
        {children}
      </div>
    ),
  },
}));

describe("EnvelopeCard", () => {
  const defaultProps = {
    id: "test-1",
    title: "Test Letter",
    date: "2024-12-25",
    isOpenable: true,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render the title", () => {
      const { getByText } = render(<EnvelopeCard {...defaultProps} />);
      expect(getByText("Test Letter")).toBeTruthy();
    });

    it("should render the date", () => {
      const { getByText } = render(<EnvelopeCard {...defaultProps} />);
      expect(getByText("2024-12-25")).toBeTruthy();
    });

    it("should truncate long titles", () => {
      const { getByText } = render(
        <EnvelopeCard
          {...defaultProps}
          title="This is a very long title that should be truncated by CSS"
        />
      );
      const titleElement = getByText(
        "This is a very long title that should be truncated by CSS"
      );
      expect(titleElement.className).toContain("truncate");
    });
  });

  describe("openable state", () => {
    it("should not show sealed indicator when openable", () => {
      const { queryByText } = render(<EnvelopeCard {...defaultProps} isOpenable={true} />);
      expect(queryByText(/Until/)).toBeNull();
    });

    it("should show sealed indicator with date when not openable", () => {
      const { getByText } = render(<EnvelopeCard {...defaultProps} isOpenable={false} />);
      expect(getByText("Until 2024-12-25")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("should call onClick when clicked", () => {
      const handleClick = vi.fn();
      const { getByTestId } = render(<EnvelopeCard {...defaultProps} onClick={handleClick} />);

      const container = getByTestId("envelope-container");
      container.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should show Open text (rendered but hidden by default)", () => {
      const { getByText } = render(<EnvelopeCard {...defaultProps} isOpenable={true} />);
      // The "Open" text is always rendered, visibility controlled by CSS
      expect(getByText("Open")).toBeTruthy();
    });

    it("should be clickable when sealed", () => {
      const handleClick = vi.fn();
      const { getByTestId } = render(
        <EnvelopeCard {...defaultProps} isOpenable={false} onClick={handleClick} />
      );

      const container = getByTestId("envelope-container");
      container.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("visual elements", () => {
    it("should render SVG envelope", () => {
      const { container } = render(<EnvelopeCard {...defaultProps} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 120 90");
    });

    it("should render wax seal when not openable", () => {
      const { container } = render(<EnvelopeCard {...defaultProps} isOpenable={false} />);
      const waxSeal = container.querySelector(".wax-seal");
      expect(waxSeal).toBeTruthy();
    });

    it("should not render wax seal when openable", () => {
      const { container } = render(<EnvelopeCard {...defaultProps} isOpenable={true} />);
      const waxSeal = container.querySelector(".wax-seal");
      expect(waxSeal).toBeNull();
    });
  });

  describe("accessibility", () => {
    it("should have cursor-pointer class for interactivity", () => {
      const { container } = render(<EnvelopeCard {...defaultProps} />);
      const clickableElement = container.querySelector(".cursor-pointer");
      expect(clickableElement).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle empty title", () => {
      const { getByText } = render(<EnvelopeCard {...defaultProps} title="" />);
      // Should still render without crashing
      expect(getByText("2024-12-25")).toBeTruthy();
    });

    it("should handle special characters in title", () => {
      const { getByText } = render(
        <EnvelopeCard {...defaultProps} title="Letter with 🎉 emoji & <special> chars" />
      );
      expect(getByText("Letter with 🎉 emoji & <special> chars")).toBeTruthy();
    });
  });
});
