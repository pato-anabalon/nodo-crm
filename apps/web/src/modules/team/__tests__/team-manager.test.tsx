import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { MembershipStatus } from "@/generated/prisma/enums";

const removeMemberAction = jest.fn().mockResolvedValue({ message: "Removed" });

// The real module is server actions, which don't load under Jest.
jest.mock("../actions", () => ({
  inviteMemberAction: jest.fn(),
  changeMemberRoleAction: jest.fn(),
  reactivateMemberAction: jest.fn(),
  suspendMemberAction: jest.fn(),
  revokeInvitationAction: jest.fn(),
  removeMemberAction: (...args: unknown[]) => removeMemberAction(...args),
}));
jest.mock("@/modules/jobs/member-trades", () => ({ MemberTrades: () => null }));

import { TeamManager } from "../team-manager";

function renderTeam() {
  return renderWithIntl(
    <TeamManager
      members={[
        {
          userId: "u2",
          name: "Wendy Worker",
          email: "wendy@example.com",
          roleId: "role-worker",
          status: MembershipStatus.ACTIVE,
          isSelf: false,
          tradeIds: [],
        },
      ]}
      invitations={[]}
      roles={[
        { id: "role-worker", label: "Worker" },
        { id: "role-sales", label: "Sales" },
      ]}
      defaultRoleId="role-sales"
      canInvite={false}
      canUpdate
      canRemove
      trades={[]}
      onSetTrades={jest.fn()}
    />,
  );
}

describe("removing somebody from the team", () => {
  beforeEach(() => removeMemberAction.mockClear());

  it("asks first, naming the person, and removes nobody on the press itself", () => {
    renderTeam();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("Remove Wendy Worker?")).toBeInTheDocument();
    expect(removeMemberAction).not.toHaveBeenCalled();
  });

  it("does nothing when the question is cancelled", () => {
    renderTeam();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(removeMemberAction).not.toHaveBeenCalled();
  });

  it("removes them only once it's confirmed", async () => {
    renderTeam();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeMemberAction).toHaveBeenCalledWith("u2"));
  });
});
