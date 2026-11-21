import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthScreen } from "../components/AuthScreen.jsx";

afterEach(() => vi.unstubAllGlobals());

describe("Authentication form", () => {
  it("validates registration fields before making a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<AuthScreen onAuthenticated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      screen.getByText("Please enter your name (1–100 characters)."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please enter a valid email address."),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows an API login error and allows a user to see the password", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ message: "Email or password is incorrect." }),
        }),
    );
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<AuthScreen onAuthenticated={onAuthenticated} />);
    await user.type(screen.getByLabelText("Email address"), "era@example.com");
    await user.type(screen.getByLabelText("Password"), "Incorrect123!");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
