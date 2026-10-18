import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUserAccount } from "@/hooks/use-supabase-data";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

describe("admin account deletion", () => {
  beforeEach(() => invokeMock.mockReset());

  it("invokes the protected server function and returns database cleanup counts", async () => {
    const cleanup = {
      deleted_messages: 2,
      deleted_medical_records: 3,
      deleted_consultations: 1,
      deleted_appointments: 1,
      deleted_vitals: 4,
      deleted_preferences: 1,
    };
    invokeMock.mockResolvedValue({ data: { deleted: true, cleanup }, error: null });

    await expect(deleteUserAccount("user-id")).resolves.toEqual(cleanup);
    expect(invokeMock).toHaveBeenCalledWith("delete-user", {
      body: { user_id: "user-id" },
    });
  });

  it("surfaces backend failures and refuses unconfirmed success responses", async () => {
    invokeMock.mockResolvedValue({ data: { error: "MFA required" }, error: null });
    await expect(deleteUserAccount("user-id")).rejects.toThrow("MFA required");

    invokeMock.mockResolvedValue({ data: { deleted: false }, error: null });
    await expect(deleteUserAccount("user-id")).rejects.toThrow(
      "The account deletion could not be confirmed.",
    );
  });
});
