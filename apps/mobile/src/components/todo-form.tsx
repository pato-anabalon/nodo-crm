import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";
import { useErrorText, useFieldError } from "@/lib/errors";
import { useMe, useSaveTodo, type TodoInput } from "@/lib/queries";
import type { Person } from "@/lib/types";
import { Avatar, personName } from "./avatars";
import { Button } from "./button";
import { DateField } from "./date-field";
import { Field } from "./field";
import { ErrorText } from "./screen";

export type TodoFormValues = {
  title: string;
  notes: string;
  startsOn: string | null;
  dueOn: string | null;
  assigneeIds: string[];
};

/**
 * Adding a to-do or changing one, in one form. Editing sends only the fields
 * that changed, so fixing a date from the phone leaves the notes somebody
 * formatted on the web exactly as they were; touching formatted notes is
 * warned about first (`notesFormatted`).
 */
export function TodoForm({
  jobId,
  target,
  initial,
  members,
  notesFormatted = false,
  submitLabel,
}: {
  jobId: string;
  target: { listId: string } | { todoId: string };
  initial: TodoFormValues;
  members: Person[];
  notesFormatted?: boolean;
  submitLabel: string;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const fieldError = useFieldError();
  const save = useSaveTodo(jobId);
  const { data: me } = useMe();
  const [values, setValues] = useState(initial);
  const set = <K extends keyof TodoFormValues>(key: K, value: TodoFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const changed = (Object.keys(values) as (keyof TodoFormValues)[]).filter(
      (key) => "listId" in target || JSON.stringify(values[key]) !== JSON.stringify(initial[key]),
    );
    if (changed.length === 0) return router.back();
    const body = Object.fromEntries(changed.map((key) => [key, values[key]])) as TodoInput;
    save.mutate({ ...target, values: body }, { onSuccess: () => router.back() });
  };

  const titleError = fieldError(save.error, "title");

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
      <ScrollView contentContainerClassName="gap-section px-gutter pb-section pt-stack-loose" keyboardShouldPersistTaps="handled">
        <View className="gap-stack-loose">
          <Field
            label={t("jobs.todos.todoTitle")}
            value={values.title}
            onChangeText={(title) => set("title", title)}
            placeholder={t("jobs.todos.todoPlaceholder")}
            error={titleError}
            autoFocus={"listId" in target}
            returnKeyType="next"
          />
          <View className="gap-1.5">
            <Field
              label={t("jobs.todos.notes")}
              value={values.notes}
              onChangeText={(notes) => set("notes", notes)}
              placeholder={t("jobs.todos.notesPlaceholder")}
              error={fieldError(save.error, "notes")}
              multiline
              textAlignVertical="top"
              className="min-h-28 rounded-xl border border-input bg-field px-4 py-3 text-body text-foreground"
            />
            {notesFormatted ? <Text className="text-footnote text-muted-foreground">{t("mobile.job.notesFormatted")}</Text> : null}
          </View>
          <DateField
            label={t("jobs.todos.startsOn")}
            value={values.startsOn}
            onChange={(day) => set("startsOn", day)}
            formatLocale={me?.company.formatLocale ?? "en-NZ"}
          />
          <DateField
            label={t("jobs.todos.dueOn")}
            value={values.dueOn}
            onChange={(day) => set("dueOn", day)}
            formatLocale={me?.company.formatLocale ?? "en-NZ"}
          />
          <ErrorText>{fieldError(save.error, "dueOn") ?? fieldError(save.error, "startsOn")}</ErrorText>
          <Assignees members={members} selected={values.assigneeIds} onChange={(ids) => set("assigneeIds", ids)} />
        </View>
        <View className="gap-stack">
          {save.error && !titleError ? <ErrorText>{errorText(save.error)}</ErrorText> : null}
          <Button label={submitLabel} busy={save.isPending} disabled={!values.title.trim()} onPress={submit} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The job's people, ticked or not — the server cuts anybody else off anyway. */
function Assignees({ members, selected, onChange }: { members: Person[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const t = useTranslations("jobs.todos");
  const tick = useColor("primary");

  return (
    <View className="gap-1.5">
      <Text className="text-footnote font-medium text-foreground">{t("assignees")}</Text>
      {members.length === 0 ? (
        <Text className="text-callout text-muted-foreground">{t("nobodyOnJob")}</Text>
      ) : (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {members.map((person, index) => {
            const on = selected.includes(person.id);
            return (
              <Pressable
                key={person.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => onChange(on ? selected.filter((id) => id !== person.id) : [...selected, person.id])}
                className={`min-h-12 flex-row items-center gap-3 px-card-pad active:bg-muted ${index ? "border-t border-border" : ""}`}
              >
                <Avatar person={person} size={28} />
                <Text className="flex-1 text-body text-card-foreground">{personName(person)}</Text>
                {on ? <Check size={20} color={tick} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
