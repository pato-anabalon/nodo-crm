"use client";

import { createContext, startTransition, useContext, useOptimistic, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FileKind } from "../files";
import type { JobActionState } from "../actions";
import { DocumentTile } from "./document-tile";

/**
 * Dragging a file onto a folder, or onto a step of the breadcrumb to take it
 * back up. Not a sortable list: files have no order, they are only dropped on
 * something, so this is `useDraggable`/`useDroppable` rather than the todos'
 * sortable. The Move dialog stays — a drag is no way in for a keyboard or a
 * screen reader, and on a phone the menu is the dependable route.
 */

export type DraggedFile = {
  id: string;
  name: string;
  folderId: string | null;
  kind: FileKind;
  extension: string;
  thumbnailUrl: string | null;
};

type DndState = {
  enabled: boolean;
  /** Moved on screen and not yet confirmed: the page hides them until the answer is in. */
  moved: ReadonlySet<string>;
  dragging: DraggedFile | null;
};

const Context = createContext<DndState>({ enabled: false, moved: new Set(), dragging: null });

/** The ids of files already dropped somewhere else, for the list to leave out. */
export function useMovedFileIds() {
  return useContext(Context).moved;
}

/** The target a drop lands on: a folder's id, or null for the top level. */
export function dropId(folderId: string | null) {
  return `folder:${folderId ?? "root"}`;
}

export function FileDndProvider({
  enabled,
  onMove,
  children,
}: {
  enabled: boolean;
  onMove: (fileId: string, folderId: string | null) => Promise<JobActionState>;
  children: ReactNode;
}) {
  const [moved, hide] = useOptimistic(new Set<string>(), (current, id: string) => new Set(current).add(id));
  const [dragging, setDragging] = useState<DraggedFile | null>(null);

  // A small distance so a click still opens the file; a held press on touch,
  // so the finger can still scroll the page. No keyboard sensor: the Move menu is that road.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function onDragStart(event: DragStartEvent) {
    setDragging((event.active.data.current?.file as DraggedFile | undefined) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const file = event.active.data.current?.file as DraggedFile | undefined;
    const target = event.over?.data.current as { folderId: string | null } | undefined;
    if (!file || !target || target.folderId === file.folderId) return;
    startTransition(async () => {
      hide(file.id);
      const result = await onMove(file.id, target.folderId);
      if (result?.error) toast.error(result.error);
      else if (result?.message) toast.success(result.message);
    });
  }

  if (!enabled) return <>{children}</>;

  return (
    <Context.Provider value={{ enabled, moved, dragging }}>
      <DndContext
        id="job-files"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <div className="flex w-44 items-center gap-2 rounded-lg border bg-card p-1.5 shadow-lg">
              <span className="size-10 shrink-0 overflow-hidden rounded">
                {dragging.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- already a small copy made at upload.
                  <img src={dragging.thumbnailUrl} alt="" draggable={false} className="size-full object-cover" />
                ) : (
                  <DocumentTile kind={dragging.kind} extension={dragging.extension} />
                )}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">{dragging.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Context.Provider>
  );
}

/** Makes what it wraps pick-up-able. Without a provider it is a plain wrapper. */
export function DraggableFile({
  file,
  className,
  children,
}: {
  file: DraggedFile;
  className?: string;
  children: ReactNode;
}) {
  const { enabled } = useContext(Context);
  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <DraggableInner file={file} className={className}>
      {children}
    </DraggableInner>
  );
}

function DraggableInner({ file, className, children }: { file: DraggedFile; className?: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `file:${file.id}`, data: { file } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // The button inside still opens the file on a click; `attributes` would make the wrapper a second one.
      role={undefined}
      tabIndex={undefined}
      className={cn("[-webkit-touch-callout:none]", isDragging && "opacity-40", className)}
    >
      {children}
    </div>
  );
}

/**
 * A place a file can be dropped. `children` gets the ref to hang on its own
 * element and whether a file is hovering over it right now. A file already in
 * that folder is no drop at all: a move to where it is would be a no-op that
 * lights up as if it meant something.
 */
export function DropTarget({
  folderId,
  disabled,
  children,
}: {
  folderId: string | null;
  disabled?: boolean;
  children: (props: { ref: (node: HTMLElement | null) => void; over: boolean }) => ReactNode;
}) {
  const { enabled, dragging } = useContext(Context);
  if (!enabled) return <>{children({ ref: () => {}, over: false })}</>;
  return (
    <DropTargetInner folderId={folderId} disabled={disabled || dragging?.folderId === folderId}>
      {children}
    </DropTargetInner>
  );
}

function DropTargetInner({
  folderId,
  disabled,
  children,
}: {
  folderId: string | null;
  disabled?: boolean;
  children: (props: { ref: (node: HTMLElement | null) => void; over: boolean }) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(folderId), data: { folderId }, disabled });
  return <>{children({ ref: setNodeRef, over: isOver && !disabled })}</>;
}

/** A breadcrumb step as a drop target. The step itself stays a server-rendered link, passed in as children. */
export function CrumbDrop({ folderId, current, children }: { folderId: string | null; current?: boolean; children: ReactNode }) {
  return (
    <DropTarget folderId={folderId} disabled={current}>
      {({ ref, over }) => (
        <span ref={ref} className={cn("rounded px-1 transition-colors", over && "bg-primary/15 ring-2 ring-primary")}>
          {children}
        </span>
      )}
    </DropTarget>
  );
}
