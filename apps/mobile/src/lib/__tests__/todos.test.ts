import { fromDayKey, toDayKey } from "../days";
import { htmlToPlainText, isFormatted, tickInLists, tickTodo } from "../todos";
import type { TodoDetail, TodoList, TodoRow } from "../types";

const row = (id: string, position: number, done = false): TodoRow => ({
  id,
  listId: "l1",
  title: id,
  position,
  hasNotes: false,
  startsOn: null,
  dueOn: "2026-11-01",
  done,
  completedAt: done ? "2026-11-02T00:00:00.000Z" : null,
  overdue: !done,
  assignees: [],
  comments: 0,
  files: 0,
});

const lists: TodoList[] = [
  { id: "l1", name: "Prep", description: null, comments: 0, open: [row("a", 1), row("b", 2), row("c", 3)], done: [row("z", 9, true)] },
  { id: "l2", name: "Coat", description: null, comments: 0, open: [row("x", 1)], done: [] },
];
const now = new Date("2026-11-08T10:00:00Z");

describe("a tick, before the server answers", () => {
  it("moves the to-do down to the top of the done ones, no longer overdue", () => {
    const [prep, coat] = tickInLists(lists, "b", true, now);
    expect(prep.open.map((todo) => todo.id)).toEqual(["a", "c"]);
    expect(prep.done.map((todo) => todo.id)).toEqual(["b", "z"]);
    expect(prep.done[0]).toMatchObject({ done: true, overdue: false, completedAt: now.toISOString() });
    expect(coat).toBe(lists[1]);
  });

  it("puts one reopened back in its own place among the open ones", () => {
    const reopened = tickInLists(tickInLists(lists, "b", true, now), "b", false, now)[0];
    expect(reopened.open.map((todo) => todo.id)).toEqual(["a", "b", "c"]);
    expect(reopened.done.map((todo) => todo.id)).toEqual(["z"]);
  });

  it("changes nothing when the state asked for is the one it has", () => {
    expect(tickInLists(lists, "z", true, now)[0]).toBe(lists[0]);
  });

  it("marks the open to-do too", () => {
    const todo = { done: false, completedAt: null, overdue: true } as TodoDetail;
    expect(tickTodo(todo, true, now)).toMatchObject({ done: true, overdue: false, completedAt: now.toISOString() });
  });
});

describe("notes into the edit box", () => {
  it("keeps paragraphs, breaks and list items as text", () => {
    expect(htmlToPlainText("<p>Sand the &amp; walls<br />twice</p><ul><li><p>North</p></li><li><p>South</p></li></ul>")).toBe(
      "Sand the & walls\ntwice\n• North\n\n• South",
    );
    expect(htmlToPlainText(null)).toBe("");
  });

  it("warns only when there is formatting a plain-text save would lose", () => {
    expect(isFormatted("<p>Plain</p><p>two<br>lines</p>")).toBe(false);
    expect(isFormatted("<p><strong>Bold</strong></p>")).toBe(true);
    expect(isFormatted("<ul><li>x</li></ul>")).toBe(true);
    expect(isFormatted(null)).toBe(false);
  });
});

it("reads and writes a picked day from its local fields, never across midnight", () => {
  const late = new Date(2026, 10, 30, 23, 59);
  expect(toDayKey(late)).toBe("2026-11-30");
  expect(toDayKey(fromDayKey("2026-01-05"))).toBe("2026-01-05");
});
