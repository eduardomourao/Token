import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/utils";

import { UsageMonitorAccessGate } from "./usage-monitor-access-gate";

const supabaseAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/features/gemini-usage/supabase-usage-monitor", () => ({
  isSupabaseUsageMonitorEnabled: () => true,
  getSupabaseUsageMonitorClient: () => ({ auth: supabaseAuth }),
}));

function renderGate() {
  return renderWithProviders(
    <UsageMonitorAccessGate><p>Hosted dashboard</p></UsageMonitorAccessGate>,
  );
}

describe("UsageMonitorAccessGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("authenticates the hosted dashboard with email and password", async () => {
    const user = userEvent.setup();
    supabaseAuth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      error: null,
    });
    renderGate();

    await user.type(screen.getByRole("textbox", { name: "E-mail" }), "owner@example.com");
    await user.type(screen.getByLabelText("Senha"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(supabaseAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "correct-password",
    }));
    expect(await screen.findByText("Hosted dashboard")).toBeInTheDocument();
  });

  it("creates an immediately authenticated account with email and password", async () => {
    const user = userEvent.setup();
    const testPassword = "new-password";
    supabaseAuth.signUp.mockResolvedValue({
      data: { session: { access_token: "new-account-token" } },
      error: null,
    });
    renderGate();

    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await user.type(screen.getByRole("textbox", { name: "E-mail" }), "owner@example.com");
    await user.type(screen.getByLabelText("Senha"), testPassword);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(supabaseAuth.signUp).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: testPassword,
    }));
    expect(await screen.findByText("Hosted dashboard")).toBeInTheDocument();
  });
});
