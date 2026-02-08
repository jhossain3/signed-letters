import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { Calendar } from "./calendar";
import { format, addYears, subYears } from "date-fns";

describe("Calendar", () => {
  it("renders with current month by default", () => {
    const { getByText } = render(<Calendar mode="single" />);
    const currentMonth = format(new Date(), "MMMM yyyy");
    expect(getByText(currentMonth)).toBeInTheDocument();
  });

  it("renders with selected date's month", () => {
    const selected = new Date(2027, 5, 15); // June 2027
    const { getByText } = render(<Calendar mode="single" selected={selected} />);
    expect(getByText("June 2027")).toBeInTheDocument();
  });

  it("navigates forward one year when year-forward button is clicked", () => {
    const now = new Date();
    const { getByTestId, getByText } = render(<Calendar mode="single" />);

    fireEvent.click(getByTestId("calendar-year-forward"));

    const expectedMonth = format(addYears(now, 1), "MMMM yyyy");
    expect(getByText(expectedMonth)).toBeInTheDocument();
  });

  it("navigates back one year when year-back button is clicked", () => {
    const now = new Date();
    const { getByTestId, getByText } = render(<Calendar mode="single" />);

    fireEvent.click(getByTestId("calendar-year-back"));

    const expectedMonth = format(subYears(now, 1), "MMMM yyyy");
    expect(getByText(expectedMonth)).toBeInTheDocument();
  });

  it("navigates multiple years forward correctly", () => {
    const now = new Date();
    const { getByTestId, getByText } = render(<Calendar mode="single" />);

    const yearForward = getByTestId("calendar-year-forward");
    for (let i = 0; i < 5; i++) {
      fireEvent.click(yearForward);
    }

    const expectedMonth = format(addYears(now, 5), "MMMM yyyy");
    expect(getByText(expectedMonth)).toBeInTheDocument();
  });

  it("allows selecting a date in a future year after navigating", () => {
    const onSelect = vi.fn();
    const { getByTestId, getByRole } = render(<Calendar mode="single" onSelect={onSelect} />);

    // Navigate 3 years forward
    const yearForward = getByTestId("calendar-year-forward");
    for (let i = 0; i < 3; i++) {
      fireEvent.click(yearForward);
    }

    // Click on day 15
    const day15 = getByRole("gridcell", { name: "15" });
    fireEvent.click(day15.firstChild as Element);

    expect(onSelect).toHaveBeenCalled();
    const selectedDate = onSelect.mock.calls[0][0] as Date;
    expect(selectedDate.getFullYear()).toBe(new Date().getFullYear() + 3);
  });

  it("combines year and month navigation correctly", () => {
    const now = new Date();
    const { getByTestId, getByText, getByLabelText } = render(<Calendar mode="single" />);

    // Go forward 2 years
    const yearForward = getByTestId("calendar-year-forward");
    fireEvent.click(yearForward);
    fireEvent.click(yearForward);

    // Then use month navigation
    fireEvent.click(getByLabelText("Go to next month"));

    const expected = new Date(now.getFullYear() + 2, now.getMonth() + 1, 1);
    const expectedLabel = format(expected, "MMMM yyyy");
    expect(getByText(expectedLabel)).toBeInTheDocument();
  });

  it("supports navigating far into the future (10+ years)", () => {
    const now = new Date();
    const { getByTestId, getByText } = render(<Calendar mode="single" />);

    const yearForward = getByTestId("calendar-year-forward");
    for (let i = 0; i < 10; i++) {
      fireEvent.click(yearForward);
    }

    const expectedMonth = format(addYears(now, 10), "MMMM yyyy");
    expect(getByText(expectedMonth)).toBeInTheDocument();
  });
});
