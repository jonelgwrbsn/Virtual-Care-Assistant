import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationManager } from "@/components/InvitationManager";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

const pendingInvitation = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "doctor@example.com",
  full_name: "Dr. Pending",
  role: "doctor",
  status: "pending",
  invited_at: "2026-10-18T00:00:00.000Z",
  expires_at: "2026-10-25T00:00:00.000Z",
  accepted_at: null,
  revoked_at: null,
};

const expiredInvitation = {
  ...pendingInvitation,
  id: "22222222-2222-4222-8222-222222222222",
  email: "doctor2@example.com",
  full_name: "Dr. Expired",
  status: "expired",
};

describe("invitation manager", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      data: { invitations: [pendingInvitation, expiredInvitation] },
      error: null,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lists invitation state and supports resend, replacement, and revoke actions", async () => {
    render(<InvitationManager />);

    expect(await screen.findByText("Dr. Pending")).toBeInTheDocument();
    expect(screen.getByText("Dr. Expired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send replacement/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send replacement/i }));
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("invite-user", {
        body: { action: "resend", invitation_id: expiredInvitation.id },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("invite-user", {
        body: { action: "revoke", invitation_id: pendingInvitation.id },
      });
    });
  });
});
