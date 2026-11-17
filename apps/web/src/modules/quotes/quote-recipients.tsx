"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "@/components/confirm-button";
import { SearchCombobox, type SearchComboboxItem } from "@/components/search-combobox";
import { useActionToast } from "@/lib/use-action-toast";
import type { ContactSearchItem } from "@/modules/contacts/actions";
import type { QuoteActionState } from "./actions";

export type RecipientView = { id: string; name: string; email: string; isPrimary: boolean };

type Pick = SearchComboboxItem & { contactId: string | null; newEmail: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Who the quote goes to: the primary — the "For" on the document — and any
 * copies. Each of them is sent their own email with their own link.
 *
 * Its own card rather than part of the quote form: the form is one big
 * `<form>`, and these act on their own, immediately, the way Quotient's do —
 * adding somebody is not something to lose by navigating away before Save.
 *
 * Every action is passed in rather than imported: importing a `"use server"`
 * module pulls in everything it imports and breaks this component's tests.
 */
export function QuoteRecipients({
  recipients,
  editable,
  search,
  addContact,
  addNew,
  remove,
  makePrimary,
}: {
  recipients: RecipientView[];
  editable: boolean;
  search: (query: string) => Promise<ContactSearchItem[]>;
  addContact: (contactId: string) => Promise<QuoteActionState>;
  addNew: (input: { firstName: string; lastName: string; email: string }) => Promise<QuoteActionState>;
  remove: (recipientId: string) => Promise<QuoteActionState>;
  makePrimary: (recipientId: string) => Promise<QuoteActionState>;
}) {
  const t = useTranslations("quotes.recipients");
  const [state, setState] = useState<QuoteActionState>({});
  const [pending, startTransition] = useTransition();
  const [newContact, setNewContact] = useState<{ email: string } | null>(null);
  useActionToast(state);

  const run = (action: () => Promise<QuoteActionState>) =>
    startTransition(async () => setState(await action()));

  const taken = new Set(recipients.map((recipient) => recipient.email.toLowerCase()));

  /*
   * The contacts that can receive it, and — when what was typed is an address
   * nobody has — a row offering to add it as a new contact. Contacts with no
   * address are left out: there would be nothing to send them.
   */
  const searchPicks = useCallback(
    async (query: string): Promise<Pick[]> => {
      const contacts = await search(query);
      const picks: Pick[] = contacts
        .filter((contact) => contact.email && !taken.has(contact.email.toLowerCase()))
        .map((contact) => ({
          id: contact.id,
          label: contact.label,
          description: contact.email,
          contactId: contact.id,
          newEmail: null,
        }));

      const typed = query.trim().toLowerCase();
      const known = contacts.some((contact) => contact.email?.toLowerCase() === typed);
      if (EMAIL.test(typed) && !known && !taken.has(typed)) {
        picks.push({
          id: `new:${typed}`,
          label: t("addContact", { email: typed }),
          description: t("addContactHint"),
          contactId: null,
          newEmail: typed,
        });
      }
      return picks;
    },
    // `taken` is rebuilt every render from `recipients`; that is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, recipients, t],
  );

  const primary = recipients.find((recipient) => recipient.isPrimary) ?? null;
  const copies = recipients.filter((recipient) => !recipient.isPrimary);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {recipients.length === 0 ? (
          <p className="text-muted-foreground italic">{t("none")}</p>
        ) : null}

        {/*
          One card per address. The row this replaced put the name, the address,
          a badge and two buttons on a single wrapping line, which on a phone
          fell apart into fragments with the buttons stranded on their own.
          A card gives each person a name, an address under it, and their own
          actions — beside it on a wide screen, underneath on a narrow one.
        */}
        <ul className="space-y-2">
          {primary ? (
            <li className="rounded-lg border p-3">
              <Person recipient={primary} tag={<Badge variant="secondary">{t("primary")}</Badge>} />
            </li>
          ) : null}

          {copies.map((recipient) => (
            <li
              key={recipient.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Person recipient={recipient} tag={<Badge variant="outline">{t("copyTo")}</Badge>} />
              {editable ? (
                <span className="flex items-center justify-between gap-1 border-t pt-2 sm:justify-end sm:border-0 sm:pt-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => makePrimary(recipient.id))}
                  >
                    <Star className="size-4" />
                    {t("makePrimary")}
                  </Button>
                  <ConfirmButton
                    disabled={pending}
                    trigger={
                      <Button type="button" variant="ghost" size="icon" className="size-8">
                        <X className="size-4" />
                        <span className="sr-only">{t("remove", { name: recipient.name })}</span>
                      </Button>
                    }
                    title={t("removeTitle", { name: recipient.name })}
                    description={t("removeDescription", { name: recipient.name })}
                    confirmLabel={t("removeConfirm")}
                    onConfirm={() => run(() => remove(recipient.id))}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {editable ? (
          <SearchCombobox<Pick>
            value={null}
            onSelect={(pick) => {
              if (!pick) return;
              if (pick.newEmail) setNewContact({ email: pick.newEmail });
              else if (pick.contactId) run(() => addContact(pick.contactId!));
            }}
            search={searchPicks}
            disabled={pending}
            placeholder={t("add")}
            searchPlaceholder={t("searchPlaceholder")}
            emptyLabel={t("empty")}
            aria-label={t("add")}
            className="sm:max-w-sm"
          />
        ) : null}
      </CardContent>

      <NewContactDialog
        email={newContact?.email ?? null}
        onClose={() => setNewContact(null)}
        onSave={async (input) => {
          const result = await addNew(input);
          setState(result);
          if (!result.error && !result.fieldErrors) setNewContact(null);
          return result;
        }}
      />
    </Card>
  );
}

/** The name with what kind of recipient they are, and the address under it. */
function Person({ recipient, tag }: { recipient: RecipientView; tag: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium break-words">{recipient.name}</span>
        {tag}
      </div>
      {recipient.name !== recipient.email ? (
        <p className="mt-0.5 text-sm break-words text-muted-foreground">{recipient.email}</p>
      ) : null}
    </div>
  );
}

/**
 * The address typed is nobody in the address book yet: name them, and they go
 * into the contacts and onto the quote together.
 *
 * Not a `<form>`: this card can sit beside the quote's own form, and a submit
 * from a dialog bubbles through React's tree to whatever form is above it.
 */
function NewContactDialog({
  email,
  onClose,
  onSave,
}: {
  email: string | null;
  onClose: () => void;
  onSave: (input: { firstName: string; lastName: string; email: string }) => Promise<QuoteActionState>;
}) {
  const t = useTranslations("quotes.recipients");

  return (
    <Dialog open={email !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newContactTitle")}</DialogTitle>
          <DialogDescription>{t("newContactDescription")}</DialogDescription>
        </DialogHeader>
        {email !== null ? (
          // Keyed by the address so a second "add" starts from empty fields.
          <NewContactFields key={email} email={email} onSave={onSave} onCancel={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NewContactFields({
  email: initialEmail,
  onSave,
  onCancel,
}: {
  email: string;
  onSave: (input: { firstName: string; lastName: string; email: string }) => Promise<QuoteActionState>;
  onCancel: () => void;
}) {
  const t = useTranslations("quotes.recipients");
  const tCommon = useTranslations("common");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const result = await onSave({ firstName, lastName, email });
      setErrors(result.fieldErrors ?? {});
    });

  return (
    <div
      className="space-y-4"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="recipient-first-name" label={t("firstName")} error={errors.firstName?.[0]}>
          <Input
            id="recipient-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoFocus
            autoComplete="off"
          />
        </Field>
        <Field id="recipient-last-name" label={t("lastName")} error={errors.lastName?.[0]}>
          <Input
            id="recipient-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>
      <Field id="recipient-email" label={t("email")} error={errors.email?.[0]}>
        <Input
          id="recipient-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tCommon("cancel")}
        </Button>
        <Button type="button" onClick={save} disabled={saving || !firstName.trim()}>
          {t("save")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
