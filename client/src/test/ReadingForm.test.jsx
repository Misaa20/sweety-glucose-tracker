import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingForm } from "../components/ReadingForm.jsx";

const today = "2026-10-15";
const renderForm = (props = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <ReadingForm today={today} onSave={onSave} onCancel={vi.fn()} {...props} />,
  );
  return { user: userEvent.setup(), onSave };
};

describe("Reading form", () => {
  it("shows required and whole-number errors without sending invalid readings", async () => {
    const { user, onSave } = renderForm();
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(
      screen.getByText("Please enter a glucose value."),
    ).toBeInTheDocument();
    for (const value of ["39", "601", "100.5"]) {
      await user.clear(screen.getByLabelText(/Glucose value/));
      await user.type(screen.getByLabelText(/Glucose value/), value);
      await user.click(screen.getByRole("button", { name: "Save reading" }));
      expect(
        screen.getByText(
          "Value must be a whole number between 40 and 600 mg/dl.",
        ),
      ).toBeInTheDocument();
    }
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks future dates and submits a valid numeric reading at the lower boundary", async () => {
    const { user, onSave } = renderForm({ defaultDate: "2026-10-16" });
    await user.type(screen.getByLabelText(/Glucose value/), "40");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(
      screen.getByText("Date cannot be in the future."),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Date"));
    await user.type(screen.getByLabelText("Date"), today);
    await user.selectOptions(screen.getByLabelText("Time slot"), "after_lunch");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        date: today,
        slot: "after_lunch",
        value: 40,
      }),
    );
  });

  it("prefills edits and lets a user edit an existing reading at the upper boundary", async () => {
    const { user, onSave } = renderForm({
      initial: { date: today, slot: "after_dinner", value: 120 },
    });
    expect(screen.getByLabelText("Time slot")).toHaveValue("after_dinner");
    await user.clear(screen.getByLabelText(/Glucose value/));
    await user.type(screen.getByLabelText(/Glucose value/), "600");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith({
      date: today,
      slot: "after_dinner",
      value: 600,
    });
  });

  it("keeps the entered value and shows a server duplicate-slot error", async () => {
    const message = "You already have an After lunch reading for this date.";
    const onSave = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error(message), { fields: { slot: message } }),
      );
    const { user } = renderForm({ onSave });
    await user.type(screen.getByLabelText(/Glucose value/), "112");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText(/Glucose value/)).toHaveValue(112);
    expect(screen.getByLabelText("Time slot")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("prevents double submission while saving and reports a daily-limit error", async () => {
    let reject;
    const onSave = vi.fn(
      () =>
        new Promise((resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    const { user } = renderForm({ onSave });
    await user.type(screen.getByLabelText(/Glucose value/), "100");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Saving…" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    reject(new Error("You can add only 4 readings per day."));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You can add only 4 readings per day.",
    );
    expect(screen.getByRole("button", { name: "Save reading" })).toBeEnabled();
  });
});
