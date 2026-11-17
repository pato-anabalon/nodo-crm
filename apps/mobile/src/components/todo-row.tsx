import { Link } from "expo-router";
import { FileText, MessageSquare, Paperclip } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";
import { formatDay } from "@/lib/format";
import type { TodoRow as Row } from "@/lib/types";
import { AvatarStack } from "./avatars";
import { TodoCheck } from "./check";

/**
 * One to-do in its list: the box to tick, the title that opens it, and what
 * hangs off it — when it's due (in the destructive colour, and said, once
 * it's late), who has it, notes, files, comments.
 */
export function TodoRow({
  todo,
  formatLocale,
  canComplete,
  onTick,
}: {
  todo: Row;
  formatLocale: string;
  canComplete: boolean;
  onTick: (done: boolean) => void;
}) {
  const t = useTranslations("jobs.todos");
  const meta = useColor("muted-foreground");
  const due = todo.dueOn ? formatDay(todo.dueOn, formatLocale) : null;
  const starts = todo.startsOn ? formatDay(todo.startsOn, formatLocale) : null;
  const when =
    starts && due ? t("dates.range", { start: starts, end: due }) : due ? t("dates.due", { date: due }) : starts ? t("dates.starts", { date: starts }) : null;

  return (
    <View className="flex-row items-start">
      <TodoCheck
        done={todo.done}
        label={t(todo.done ? "markOpen" : "markDone", { title: todo.title })}
        disabled={!canComplete}
        onChange={onTick}
      />
      <Link href={{ pathname: "/todos/[id]", params: { id: todo.id } }} asChild>
        <Pressable accessibilityRole="button" className="min-h-12 flex-1 justify-center gap-1 py-2.5 pr-card-pad active:opacity-70">
          <Text className={`text-body ${todo.done ? "text-muted-foreground line-through" : "text-card-foreground"}`}>{todo.title}</Text>
          {when || todo.assignees.length || todo.hasNotes || todo.files || todo.comments ? (
            <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
              {when ? (
                <Text className={`text-footnote ${todo.overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                  {when}
                  {todo.overdue ? ` · ${t("overdue")}` : ""}
                </Text>
              ) : null}
              <AvatarStack people={todo.assignees} size={20} />
              {todo.hasNotes ? <FileText size={14} color={meta} accessibilityLabel={t("hasNotes")} /> : null}
              {todo.files ? <Count icon={<Paperclip size={14} color={meta} />} count={todo.files} /> : null}
              {todo.comments ? <Count icon={<MessageSquare size={14} color={meta} />} count={todo.comments} /> : null}
            </View>
          ) : null}
        </Pressable>
      </Link>
    </View>
  );
}

function Count({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <View className="flex-row items-center gap-1">
      {icon}
      <Text className="text-footnote text-muted-foreground">{count}</Text>
    </View>
  );
}
