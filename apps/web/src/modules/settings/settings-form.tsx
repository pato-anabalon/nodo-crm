"use client";

import { createContext, useActionState, useContext, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Option, OptionGroup } from "@/lib/intl/options";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/rich-text-editor";
import { toRichTextHtml } from "@/lib/rich-text";
import type { SettingsState } from "./actions";

/**
 * Field errors travel through context rather than a render prop.
 *
 * A function can't cross the server-to-client boundary: `children` has to be
 * already-built elements, and each field asks for itself whether it should show
 * an error.
 */
const FieldErrors = createContext<Record<string, string[]>>({});

function useFieldError(name: string): string | undefined {
  return useContext(FieldErrors)[name]?.[0];
}

export function SettingsForm({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  children: React.ReactNode;
}) {
  const t = useTranslations("settings");
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(action, {});

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-5">
          <FieldErrors.Provider value={state.fieldErrors ?? {}}>{children}</FieldErrors.Provider>

          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  hint,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const error = useFieldError(name);

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  hint,
  defaultValue,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <Field label={label} name={name} hint={hint}>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} {...rest} />
    </Field>
  );
}

export function AreaField({
  label,
  name,
  hint,
  defaultValue,
  rows = 4,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <Field label={label} name={name} hint={hint}>
      <Textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ""} />
    </Field>
  );
}

/**
 * Same field shape as `AreaField`, a formatted editor instead of plain text.
 *
 * Not built on `Field`: that wraps the label in a `htmlFor` pointing at an
 * `id` the editor doesn't have — `RichTextEditor` is several elements, not
 * one input, and takes the label as `ariaLabel` instead (same as the quote
 * form's section body, the one place this editor already shipped).
 */
export function RichAreaField({
  label,
  name,
  hint,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const error = useFieldError(name);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {/* Content written before this editor existed was plain text; this is
          what makes it still read as paragraphs instead of one run-on line. */}
      <RichTextEditor
        name={name}
        defaultValue={toRichTextHtml(defaultValue)}
        ariaLabel={label}
        placeholder={placeholder}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
  groups,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options?: Option[];
  /** For lists too long to scan flat — the timezones, grouped by region. */
  groups?: OptionGroup[];
  hint?: string;
}) {
  return (
    <Field label={label} name={name} hint={hint}>
      <NativeSelect
        id={name}
        name={name}
        defaultValue={defaultValue}
        options={options}
        groups={groups}
      />
    </Field>
  );
}

export function CheckField({
  label,
  name,
  hint,
  defaultChecked,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-3 text-sm">
        <Checkbox id={name} name={name} defaultChecked={defaultChecked} className="mt-0.5" />
        <span>{label}</span>
      </label>
      {hint ? <p className="pl-7 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FieldRow({
  columns = 2,
  children,
}: {
  columns?: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-4 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {children}
    </div>
  );
}
