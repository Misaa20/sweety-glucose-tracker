import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoctorDashboard } from "../DoctorDashboard.jsx";

afterEach(() => vi.unstubAllGlobals());
const doctor = {
  name: "Dr. Maya Patel",
  email: "doctor@example.com",
  role: "doctor",
};
const patients = [
  { id: 1, name: "Alex Morgan", email: "alex@example.com" },
  { id: 2, name: "Sam Patel", email: "sam@example.com" },
];
const summary = {
  start: "2026-10-15",
  end: "2026-10-15",
  count: 0,
  highest: null,
  lowest: null,
  average: null,
};
const report = (patient) => ({
  patient,
  date: "2026-10-15",
  daily: summary,
  monthToDate: summary,
  monthly: summary,
  readings: [],
  trend: [],
});
const response = (body) => ({ ok: true, status: 200, json: async () => body });

describe("Doctor workspace", () => {
  it("switches assigned patients and shows read-only reports without reading controls", async () => {
    const fetch = vi.fn(async (url) => {
      if (url === "/api/doctor/patients") return response({ patients });
      return response(
        report(url.includes("/patients/2/") ? patients[1] : patients[0]),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <DoctorDashboard
        user={doctor}
        meta={{ today: "2026-10-15", timezone: "Asia/Kolkata" }}
        onLogout={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Alex Morgan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Read-only reports")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Add reading|Edit reading|Delete reading/,
      }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Assigned patient"), "2");
    expect(
      await screen.findByRole("heading", { name: "Sam Patel" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/doctor/patients/2/reports?date=2026-10-15",
      expect.any(Object),
    );
  });

  it("shows a friendly empty state when no patients are assigned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ patients: [] })),
    );
    render(
      <DoctorDashboard
        user={doctor}
        meta={{ today: "2026-10-15", timezone: "Asia/Kolkata" }}
        onLogout={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "No patients assigned yet." }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Assigned patient")).not.toBeInTheDocument();
  });

  it("shows report-access errors and refreshes assignments when retrying", async () => {
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (url === "/api/doctor/patients") {
          if (first) return response({ patients: [patients[0]] });
          return response({ patients: [] });
        }
        first = false;
        return {
          ok: false,
          status: 404,
          json: async () => ({
            message: "Patient not found or not assigned to you.",
          }),
        };
      }),
    );
    const user = userEvent.setup();
    render(
      <DoctorDashboard
        user={doctor}
        meta={{ today: "2026-10-15", timezone: "Asia/Kolkata" }}
        onLogout={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Patient not found or not assigned to you.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "No patients assigned yet." }),
      ).toBeInTheDocument(),
    );
  });
});
