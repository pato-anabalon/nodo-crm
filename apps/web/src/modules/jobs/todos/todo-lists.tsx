"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarDays, Check, FileText, GripVertical, MessageSquare, Paperclip } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { JobActionState } from "../actions";
import { AvatarStack } from "../avatars";
import type { TodoItem } from "./view";

type Toggle = (todoId: string, done: boolean) => Promise<JobActionState>;
type Reorder = (ids: string[]) => Promise<JobActionState>;

export type TodoListData = {
  id: string;
  name: string;
  href: string;
  /** Rendered on the server: it is rich text, and the sanitiser stays there. */
  description: ReactNode;
  comments: number;
  open: TodoItem[];
  done: TodoItem[];
  onReorder: Reorder;
  /** The "add a to-do" box, or null for somebody who can't add one. */
  addForm: ReactNode;
};

function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/** Runs an action and says so if it was refused; the optimistic state undoes itself. */
async function settle(promise: Promise<JobActionState>) {
  const result = await promise;
  if (result?.error) toast.error(result.error);
}

/**
 * The box beside a to-do. A real button with `role="checkbox"`, not a form
 * control: ticking posts straight away rather than waiting for a Save.
 */
export function TodoCheck({
  checked,
  disabled,
  label,
  onChange,
  size = "default",
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  size?: "default" | "lg";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded border-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed",
        size === "lg" ? "size-7" : "size-5",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/50 bg-background hover:border-primary disabled:hover:border-muted-foreground/50",
      )}
    >
      {checked ? <Check className={size === "lg" ? "size-4" : "size-3.5"} strokeWidth={3} /> : null}
    </button>
  );
}

function TodoLine({
  item,
  canComplete,
  onToggle,
  handle,
}: {
  item: TodoItem;
  canComplete: boolean;
  onToggle: (item: TodoItem, done: boolean) => void;
  handle?: ReactNode;
}) {
  const t = useTranslations("jobs.todos");
  return (
    <div className="flex items-start gap-2 py-1.5">
      {handle}
      <span className="pt-0.5">
        <TodoCheck
          checked={item.done}
          disabled={!canComplete}
          label={item.done ? t("markOpen", { title: item.title }) : t("markDone", { title: item.title })}
          onChange={(checked) => onToggle(item, checked)}
        />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={item.href}
          className={cn("break-words text-sm hover:underline", item.done && "text-muted-foreground line-through")}
        >
          {item.title}
        </Link>
        {item.assignees.length > 0 || item.when || item.comments > 0 || item.files > 0 || item.hasNotes ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.assignees.length > 0 ? <AvatarStack people={item.assignees} max={4} /> : null}
            {item.when ? (
              <span className={cn("inline-flex items-center gap-1", item.overdue && "font-medium text-destructive")}>
                <CalendarDays className="size-3.5" />
                {item.when}
              </span>
            ) : null}
            {item.hasNotes ? <FileText className="size-3.5" aria-label={t("hasNotes")} /> : null}
            {item.comments > 0 ? (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3.5" />
                {item.comments}
              </span>
            ) : null}
            {item.files > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="size-3.5" />
                {item.files}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SortableTodo({
  item,
  canComplete,
  onToggle,
}: {
  item: TodoItem;
  canComplete: boolean;
  onToggle: (item: TodoItem, done: boolean) => void;
}) {
  const t = useTranslations("jobs.todos");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded bg-card", isDragging && "relative z-10 opacity-70 shadow-md")}
    >
      <TodoLine
        item={item}
        canComplete={canComplete}
        onToggle={onToggle}
        handle={
          <button
            type="button"
            aria-label={t("dragTodo", { title: item.title })}
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  );
}

type ListState = { open: TodoItem[]; done: TodoItem[] };
type ListChange = { type: "order"; ids: string[] } | { type: "toggle"; id: string; done: boolean };

/**
 * Applies a change before the server has answered. When the action settles the
 * page is revalidated and the real list replaces this one; if it was refused,
 * the list simply goes back to what it was.
 */
function applyChange(state: ListState, change: ListChange): ListState {
  if (change.type === "order") {
    const byId = new Map(state.open.map((item) => [item.id, item]));
    return { ...state, open: change.ids.flatMap((id) => byId.get(id) ?? []) };
  }
  const all = [...state.open, ...state.done];
  const item = all.find((todo) => todo.id === change.id);
  if (!item) return state;
  const moved = { ...item, done: change.done, overdue: change.done ? false : item.overdue };
  if (change.done) {
    return { open: state.open.filter((todo) => todo.id !== change.id), done: [moved, ...state.done] };
  }
  // Back on: to the place it had before it was ticked off.
  const open = [...state.open, moved].sort((a, b) => a.position - b.position);
  return { open, done: state.done.filter((todo) => todo.id !== change.id) };
}

/** One list: its open to-dos in their order, the box to add one, and the done ones tucked below. */
export function TodoListBlock({
  list,
  canReorder,
  canComplete,
  onToggle,
  header,
}: {
  list: TodoListData;
  canReorder: boolean;
  canComplete: boolean;
  onToggle: Toggle;
  /** The list's heading — absent on the list's own page, which has its own. */
  header?: ReactNode;
}) {
  const t = useTranslations("jobs.todos");
  const [state, apply] = useOptimistic<ListState, ListChange>({ open: list.open, done: list.done }, applyChange);
  const [, startTransition] = useTransition();
  const [showDone, setShowDone] = useState(false);
  const sensors = useDragSensors();

  function toggle(item: TodoItem, done: boolean) {
    startTransition(async () => {
      apply({ type: "toggle", id: item.id, done });
      await settle(onToggle(item.id, done));
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = state.open.map((item) => item.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(ids, from, to);
    startTransition(async () => {
      apply({ type: "order", ids: next });
      await settle(list.onReorder(next));
    });
  }

  const total = state.open.length + state.done.length;

  return (
    <div className="space-y-2">
      {header}
      {list.description}

      {state.open.length > 0 ? (
        canReorder ? (
          <DndContext id={`todos-${list.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={state.open.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul>
                {state.open.map((item) => (
                  <SortableTodo key={item.id} item={item} canComplete={canComplete} onToggle={toggle} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul>
            {state.open.map((item) => (
              <li key={item.id}>
                <TodoLine item={item} canComplete={canComplete} onToggle={toggle} />
              </li>
            ))}
          </ul>
        )
      ) : total > 0 ? (
        <p className="py-1 text-sm italic text-muted-foreground">{t("allDone")}</p>
      ) : null}

      {list.addForm}

      {state.done.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            {showDone ? t("hideDone") : t("showDone", { count: state.done.length })}
          </button>
          {showDone ? (
            <ul className="mt-1">
              {state.done.map((item) => (
                <li key={item.id}>
                  <TodoLine item={item} canComplete={canComplete} onToggle={toggle} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A list's heading on the page of all lists: its name, how far along it is, its conversation. */
function ListHeading({ list, handle, done, total }: { list: TodoListData; handle?: ReactNode; done: number; total: number }) {
  const t = useTranslations("jobs.todos");
  return (
    <div className="flex items-start gap-2">
      {handle}
      <div className="min-w-0 flex-1">
        <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link href={list.href} className="text-lg font-semibold hover:underline">
            {list.name}
          </Link>
          <span className="text-sm text-muted-foreground">{t("progress", { done, total })}</span>
          {list.comments > 0 ? (
            <Link href={`${list.href}#comments`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
              <MessageSquare className="size-3.5" />
              {list.comments}
            </Link>
          ) : null}
        </h2>
        {total > 0 ? (
          <div className="mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ListCard({
  list,
  handle,
  canReorderTodos,
  canComplete,
  onToggle,
}: {
  list: TodoListData;
  handle?: ReactNode;
  canReorderTodos: boolean;
  canComplete: boolean;
  onToggle: Toggle;
}) {
  return (
    <TodoListBlock
      list={list}
      canReorder={canReorderTodos}
      canComplete={canComplete}
      onToggle={onToggle}
      header={<ListHeading list={list} handle={handle} done={list.done.length} total={list.open.length + list.done.length} />}
    />
  );
}

function SortableListCard(props: Omit<Parameters<typeof ListCard>[0], "handle">) {
  const t = useTranslations("jobs.todos");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.list.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-xl border bg-card p-4 sm:p-5", isDragging && "relative z-10 shadow-lg")}
    >
      <ListCard
        {...props}
        handle={
          <button
            type="button"
            aria-label={t("dragList", { name: props.list.name })}
            className="-ml-1 mt-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  );
}

/** Every list on the job, each in its card, in the order somebody arranged them. */
export function TodoListsBoard({
  lists,
  canReorder,
  canComplete,
  onToggle,
  onReorderLists,
}: {
  lists: TodoListData[];
  canReorder: boolean;
  canComplete: boolean;
  onToggle: Toggle;
  onReorderLists: Reorder;
}) {
  const t = useTranslations("jobs.todos");
  const [order, setOrder] = useOptimistic<string[], string[]>(
    lists.map((list) => list.id),
    (_current, next) => next,
  );
  const [, startTransition] = useTransition();
  const sensors = useDragSensors();
  const byId = new Map(lists.map((list) => [list.id, list]));
  const shown = order.flatMap((id) => byId.get(id) ?? []);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(order, from, to);
    startTransition(async () => {
      setOrder(next);
      await settle(onReorderLists(next));
    });
  }

  if (!canReorder) {
    return (
      <ul className="space-y-4">
        {lists.map((list) => (
          <li key={list.id} className="rounded-xl border bg-card p-4 sm:p-5">
            <ListCard list={list} canReorderTodos={false} canComplete={canComplete} onToggle={onToggle} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <DndContext id="todo-lists" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="space-y-4" aria-label={t("title")}>
          {shown.map((list) => (
            <SortableListCard key={list.id} list={list} canReorderTodos canComplete={canComplete} onToggle={onToggle} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/** The box on a to-do's own page. */
export function TodoPageCheck({
  todoId,
  title,
  done,
  canComplete,
  onToggle,
}: {
  todoId: string;
  title: string;
  done: boolean;
  canComplete: boolean;
  onToggle: Toggle;
}) {
  const t = useTranslations("jobs.todos");
  const [checked, setChecked] = useOptimistic(done);
  const [, startTransition] = useTransition();
  return (
    <TodoCheck
      size="lg"
      checked={checked}
      disabled={!canComplete}
      label={checked ? t("markOpen", { title }) : t("markDone", { title })}
      onChange={(next) =>
        startTransition(async () => {
          setChecked(next);
          await settle(onToggle(todoId, next));
        })
      }
    />
  );
}
