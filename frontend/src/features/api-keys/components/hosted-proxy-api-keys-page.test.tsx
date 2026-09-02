import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/utils";
import { HostedProxyApiKeysPage } from "./hosted-proxy-api-keys-page";

vi.mock("../hosted-proxy-api-keys", () => ({
  listHostedProxyApiKeys: vi.fn().mockResolvedValue([{
    id: "key-a", name: "Notebook", key_prefix: "sk-clb-example", is_active: true,
    expires_at: null, created_at: "2026-09-02T00:00:00Z", last_used_at: null,
  }]),
  createHostedProxyApiKey: vi.fn(),
  revokeHostedProxyApiKey: vi.fn(),
}));

describe("HostedProxyApiKeysPage", () => {
  it("shows owner-managed Responses keys without revealing a stored secret", async () => {
    renderWithProviders(<HostedProxyApiKeysPage />);

    expect(await screen.findByRole("heading", { name: "API keys do proxy" })).toBeInTheDocument();
    expect(await screen.findByText("Notebook")).toBeInTheDocument();
    expect(screen.getByText("sk-clb-example…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revogar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao Dashboard" })).toHaveAttribute("href", "/dashboard");
  });
});
