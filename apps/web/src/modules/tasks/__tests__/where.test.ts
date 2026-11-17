import { taskWhere } from "../scope";

const me = "user_me";

describe("taskWhere", () => {
  it("shows what was assigned to me", () => {
    const where = taskWhere({ scope: "mine", show: "open" }, me);
    expect(where.OR).toContainEqual({ assigneeId: me });
  });

  /**
   * The bug this exists for: a task added without an assignee belonged to
   * nobody, so it vanished from the only list its author was looking at. Added,
   * confirmed by a snackbar, and gone.
   */
  it("also shows what I wrote down and nobody has taken", () => {
    const where = taskWhere({ scope: "mine", show: "open" }, me);
    expect(where.OR).toContainEqual({ assigneeId: null, createdById: me });
  });

  it("does not show somebody else's unassigned task", () => {
    const where = taskWhere({ scope: "mine", show: "open" }, me);
    // The unassigned branch is tied to who wrote it, not left open.
    expect(where.OR).not.toContainEqual({ assigneeId: null });
  });

  it("filters nothing by person when the scope is everything", () => {
    expect(taskWhere({ scope: "all", show: "open" }, me)).toEqual({ completedAt: null });
  });

  it("asks for open tasks by their absence of a completion", () => {
    expect(taskWhere({ scope: "all", show: "open" }, me).completedAt).toBeNull();
  });

  it("asks for done tasks by the presence of one", () => {
    expect(taskWhere({ scope: "all", show: "done" }, me).completedAt).toEqual({ not: null });
  });

  it("keeps the done filter when the scope narrows to me", () => {
    expect(taskWhere({ scope: "mine", show: "done" }, me).completedAt).toEqual({ not: null });
  });
});
