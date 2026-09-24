import { taskFormSchema } from "../schemas";

const base = { title: "Ring the supplier" };

describe("taskFormSchema", () => {
  it("accepts a task with only a title", () => {
    const parsed = taskFormSchema.parse(base);
    expect(parsed.title).toBe("Ring the supplier");
    expect(parsed.dueAt).toBeNull();
  });

  it("puts a due date at the end of its day", () => {
    // "Due the 10th" must not be overdue at one minute past midnight.
    const parsed = taskFormSchema.parse({ ...base, dueAt: "2026-03-10" });
    expect(parsed.dueAt?.toISOString()).toBe("2026-03-10T23:59:59.999Z");
  });

  it("treats an empty date as no date at all", () => {
    expect(taskFormSchema.parse({ ...base, dueAt: "" }).dueAt).toBeNull();
    expect(taskFormSchema.parse({ ...base, dueAt: "   " }).dueAt).toBeNull();
  });

  it("refuses a date that isn't one", () => {
    expect(taskFormSchema.safeParse({ ...base, dueAt: "mañana" }).success).toBe(false);
  });

  it("needs a title worth reading", () => {
    expect(taskFormSchema.safeParse({ title: "ok" }).success).toBe(false);
  });

  it("turns empty links into nothing rather than empty strings", () => {
    const parsed = taskFormSchema.parse({ ...base, leadId: "", assigneeId: "  " });
    expect(parsed.leadId).toBeNull();
    expect(parsed.assigneeId).toBeNull();
  });
});
