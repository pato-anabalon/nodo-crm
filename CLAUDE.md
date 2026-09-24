# Nodo CRM

Multi-company CRM. Each company operates on its own subdomain, with its logo,
its colours, its users and its profiles, and **never sees the others' data**.

## Stack

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack) |
| UI | shadcn/ui + Tailwind v4 |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Database | Neon Postgres (Vercel integration) |
| Auth | Auth.js v5 (credentials + magic link via Resend) |
| Email | Resend |
| i18n | next-intl (British English and Spanish) |
| Files | Vercel Blob (logo, terms PDF, quote attachments) |
| Tests | Jest + React Testing Library |

## How each company is isolated

Three layers, from the outside in:

1. **`src/proxy.ts`** — resolves the company from the host (`acme.domain` →
   slug `acme`) and rewrites to `/s/acme/...`. The visible URL doesn't change.
2. **`src/lib/auth/session.ts`** — `requireCompanyContext()` demands a session
   *and* an active membership in that company. It is the only place that
   queries across companies.
3. **`src/lib/db/tenant.ts`** — `ctx.db` is an extended Prisma client that
   injects the company filter into **every** operation. If a query forgets
   `where: { companyId }`, it gets filtered anyway.

> Rule: in module code always use `ctx.db`, never `prisma` directly. `prisma` is
> reserved for registration, login and platform tasks, where crossing between
> companies is intentional and visible.

### When adding a model to the schema

**It has to be classified** in `tenant-scope.ts`: `DIRECT_TENANT_MODELS` if it
carries `companyId`, `RELATION_TENANT_MODELS` if it inherits one through a
relation, or `GLOBAL_MODELS` if it genuinely belongs to no company.

Forgetting breaks nothing visible: the queries keep working, they just return
rows from every company. It happened with ten models — reviews, ingest keys,
quote links — and one company got to see another's data. `tenant-coverage.test.ts`
reads the schema and fails if a model is left unclassified; that is what stops it
happening again.

### The `where` of unique operations

`findUnique`, `update`, `delete` and `upsert` require Prisma to see a unique
field **at the top level** of the `where`. That is why the company filter is
merged there (`{ id, companyId }`) instead of being wrapped in an `AND`: inside
an `AND` the id stops counting as unique and Prisma rejects the call. List
operations do use `AND`, which never clashes with what the caller wrote.

The pure logic of point 3 lives in `src/lib/db/tenant-scope.ts` and is covered by
tests (`applyTenantScope`).

## The code goes in English

Comments, test names, internal error messages, routes and the Prisma schema:
**all in English**, no matter which language the person reading works in. The
only thing in Spanish is `messages/es.json`, which is interface translation, not
code.

Routes too: `/quotes`, `/reports`, `/settings`, `/leads/new`. A user with the
interface in Spanish sees "Cotizaciones" on screen and `/quotes` in the address
bar, which is the right thing.

## Light and dark

Switched by a `.dark` class on `<html>`, set by next-themes — already a
dependency, and `ui/sonner.tsx` had been calling `useTheme()` for a while with no
provider above it. The choice lives in `localStorage` and is applied by a
blocking script before first paint, which is why `<html>` carries
`suppressHydrationWarning`: the server cannot know the choice, so that attribute
is expected to differ.

The toggle picks its icon with CSS (`dark:hidden`), not React state, so the
button renders identically on both sides and needs no "wait until mounted" dance.

`--panel` is the surface behind the main pane and **only** behind it: `#f2f2f2`
in light, a shade above the chrome in dark. Cards, inputs and menus keep
`--card`/`--background`, so they read as sitting on top of the panel rather than
being tinted by it. The stack is the same in both themes — chrome, then panel,
then card.

> The company's colour still wins over the theme. `BrandTheme` writes
> `:root{--primary:…}` from a `<style>` after the stylesheet, so in dark mode the
> brand colour is used rather than the dark-tuned one. That is right for a brand,
> but a company whose colour is very dark would get a primary button that barely
> separates from the dark panel. Both companies on record sit at L≈0.55–0.61 and
> are fine; a lightness floor for dark mode is the fix if one ever isn't.

### The brand as a fill, and the brand as text

`--brand-ink` is the company's colour **as text**, and it is not the same value
as `--primary`. A brand colour is chosen to sit *under* white on a button, which
is a different problem from being the writing itself: PlasterPro's orange reads
4.18:1 on a white card and the default blue 2.87:1 on the dark one — both fine
as a fill, neither readable as an 11px label.

`inkOn` keeps the hue and the chroma, so it still reads as the brand, and moves
only the lightness until the contrast clears 4.5:1 — **against each ground
separately**, because a dark theme is not the light one inverted. It steps and
measures rather than computing a lightness directly: OKLCH lightness and WCAG
luminance are different models, and the honest way to know whether a colour
passes is to convert it and measure. A colour that already passes is returned
untouched, so a company whose brand reads fine sees its own value.

The same answer `--status-*-text` gives, for the same reason: colours chosen
against the ground they sit on, not the fill set lightened. The customer's quote
uses it for the field names — FROM, PHONE, GST NUMBER — which brands the document
without tinting a single figure anybody has to read.

## The company's two images

Uploaded as a file, not pasted as an address. It is stored in Vercel Blob under
`companies/<id>/logo.<ext>` and its URL goes into the same `Company.logoUrl` that
the sidebar, the sign-in page and the customer's quote already read — so nothing
downstream knows or cares where the file came from.

- **Raster only** (PNG, JPEG, WebP), up to 2 MB. SVG is refused: it can carry a
  script, and this image is rendered for the end customer. Nothing about a logo
  needs a scriptable format.
- **The extension comes from the content type**, never from the uploaded
  filename, and the name in the store is fixed — there is only ever one logo.
- **A random suffix is what makes a new upload a new URL.** Without it the
  browser and the CDN would go on serving the old logo from cache.
- **The old file is deleted after the new one is saved**, not before: an orphan
  in the store costs kilobytes, a company with no logo shows on every page.
- **Only our own files are deleted.** A company that pointed `logoUrl` at its own
  CDN before uploads existed keeps working, and replacing it must not try to
  delete a file on somebody else's server (`isStoredLogo`).

With no logo, `CompanyLogo` falls back to the company's initials, which is also
what the settings screen previews — so what is shown there is literally what the
rest of the system renders.

### The watermark

The second image: stamped faintly in the bottom corner of the quote the customer
opens. Every rule above is shared with the logo — raster only, 2 MB, the
extension from the content type, the random suffix, the old file deleted after
the new one is in place — which is why they live in one module and one upload
action rather than as a copy with the word changed. Only the file's name in the
store differs, and a test holds the two side by side so a third image can't
arrive with a weaker set of checks.

**Behind the reviews, at 500px, and not fixed.** A watermark that followed the
reader would sit over the accept button. Behind the reviews it is large enough to
read as a mark rather than a stray thumbnail, while the only thing over it is
short text the customer has already been given in full elsewhere.

Two details hold that up. **Both the image and the reviews are positioned and the
image comes first**, so the reviews paint on top by document order — a negative
z-index would work until the first stacking context appeared above this, and then
slide the mark behind the page instead. And the box carries a `min-h`, because a
company with a watermark and no reviews yet has nothing for the image to float
inside, and it would escape upward over the message thread.

**It bleeds 125px past the document's right edge**, which is what stops it
reading as a picture placed in a corner. Those 125px also widen the page, and a
horizontal scrollbar on the customer's quote is not a trade worth making, so the
document sits inside a box that clips horizontally: the bleed shows wherever
there is room for it and is cut where there isn't. `overflow-x: clip` rather
than `hidden` — `hidden` would make that box a scroll container, and a scroll
container is how `position: sticky` inside it stops working.

It carries no `no-print`, on purpose: appearing on the printed quote is most of
what a watermark is for. And it is decoration as far as a screen reader is
concerned — the company is named all over the document already, so reading its
mark out again at the end says nothing.

> **The settings preview shows it at the opacity it is actually rendered at.** A
> mark that looks right at full strength and vanishes on the page is the mistake
> the preview exists to catch — the same reason the logo is previewed through the
> very `CompanyLogo` the rest of the system uses.

## Uploading a file

One `FilePicker` for the three places a file goes in — a quote's attachments,
the company's logo, the terms PDF. The same reason `RichText` is one component:
the third site is where they start to drift.

- **The native input is hidden rather than styled.** The browser draws its own
  "Choose File" chrome inside it, which reads as a text field with a word in it
  and not as something to press, and no stylesheet reaches it. A button that
  clicks the input is a real button, and the chosen name goes beside it, where a
  person can check it before sending.
- **Send sits beside the file it acts on.** Laid out as a row of fields it
  drifted to the far edge of the card, the width of the panel from the thing it
  was about to upload. It is also disabled until there is a file, so the only
  way to reach the error "choose a file" is to bypass the form.
- **Deleting asks, and the question names the thing.** "Delete this?" tells you
  nothing you can check. The document one also says the cost: a quote *links* its
  terms rather than copying them (`SetNull`), so deleting the PDF takes the terms
  off quotes the customer already has open.

> **`sr-only` is `position: absolute` with no offsets.** With no positioned
> ancestor it hangs off the document: the 1×1 input landed at the bottom of the
> page and gave the quote a few hundred pixels of empty scroll that nothing on
> screen explained — the sidebar scrolled away and there was no visible cause.
> The `relative` on the picker's own box is that ancestor, and a test asserts it,
> because jsdom computes no layout and the symptom can't be caught any other way.

### The hidden controls need somewhere to hang

Twice now the same shape: an input the user never sees, absolutely positioned,
with nothing positioned around it — so it answers to the document, lands at the
foot of the page, and gives the whole shell a scrollbar that nothing on screen
explains. It costs a DevTools hunt for a one-pixel element every time.

- **`sr-only`** is `position: absolute` with no offsets. That is the file input
  above, and the `sr-only` labels that name an icon button — which is why
  `Button` carries `relative`.
- **A checkbox posts through an input, not through the button you see.** Given a
  `name` inside a form, Radix renders a real `<input type="checkbox">` beside the
  control and styles it `position: absolute` with `translateX(-100%)` inline; its
  own comment says this "pulls it back to sit on top of the button", which is
  only true if something around the pair is positioned.

Both fixes live in the component rather than on the screens that use it — four
`relative` classes spread across settings is exactly how the fifth checkbox
arrives without one. The checkbox's wrapper cost one thing: `Label` dims from
`peer-disabled`, which needs the control to be its own previous sibling, and it
now sits inside that wrapper. The permission grid says it on the row instead,
through the `group-data-[disabled=true]` that `Label` already carries.

> jsdom computes no layout, so the tests assert the **cause** — the hidden input
> has a positioned parent — rather than the scrollbar. There is no other way to
> catch it, and no way to notice it by reading the screen.

## Notices: who gets what

`NotificationPreference` stores **only the opt-outs**: if there is no row, the
notice is sent. That way inviting someone doesn't force seeding four rows, and
adding a new notice type doesn't silently leave out the people who signed up
earlier.

Preferences are per company, because the same person can be an owner involved in
everything at one and an occasional viewer at another. They are edited at
`/settings/notifications` and require no permission: they are each person's own
email, not a company decision.

If someone turned a notice off and they were the lead's owner, **it is not passed
on to the rest of the team**: that would be an odd way of respecting their
choice.

### The bell

`Notification` stores a **kind and its parameters, never a sentence**: the same
notice has to read in whatever language its recipient works in, and that can
change after it was written. The text is rendered when it is asked for.

`dedupeKey` is what keeps a recurring condition from filling the bell — a task
overdue for a week nags once a day, not once per page view. It is unique per
person, so one event can notify several people once each.

**Every kind reaches both doorways.** Four of the nine once reached only email —
a lead arriving, a quote opened, a quote decided, a customer writing — because
the bell was built wiring `notify()` into whichever paths were open at the time.
The result was a bell silent for everything a customer does and loud only for
tasks and the nightly sweep. `bell-coverage.test.ts` reads the source and fails
if a kind has nobody raising it: the sibling test demanded every kind be
*turnable off* and none demanded that any be *turned on*.

> Parameters travel as tokens, never as words. `QUOTE_DECIDED` carries
> `decision: "accepted"` and each language picks its own word with an ICU
> `select`. A pre-translated word would freeze in the sender's language, which
> is the whole reason a notification stores a kind and its parameters.

**Overdue tasks become notices when somebody opens the app**, not by a scheduled
job (`syncDueTasks`, called from the bell's own endpoint). For a bell that is
exactly right: the notice exists the moment there is an eye to read it, and it
needs no infrastructure. Email for the same thing would need a scheduler, and
that is separate work.

The unread count is read on the server so the bell is right on the first paint;
the effect in the component only subscribes to updates from there.

The same opt-out governs both doorways: a kind somebody turned off stops
arriving by email **and** in the bell. A test asserts `NOTIFICATION_KINDS` covers
the whole enum — a notice you can receive and cannot turn off is not a setting.

### Whose task is it

"Mine" is **assigned to me, or unassigned and written by me** — not assignment
alone. A task added without an assignee used to belong to nobody, so it
disappeared from the only list its author was looking at: added, confirmed by a
snackbar, and nowhere. The rule is `taskWhere` in `tasks/scope.ts`, pure so it
can be checked without a database — which matters here because getting it wrong
is invisible. The row saves, the action reports success, and the list it should
have joined simply doesn't contain it.

The form's assignee also **starts on whoever is adding the task**. Somebody
typing something into their own list means it for themselves unless they say
otherwise; "nobody" stays available as a deliberate choice rather than as the
path of least resistance.

### The daily sweep

`/api/cron/daily` runs once a day and raises the three things nobody would
otherwise find out: a sent quote quietly running out, a web form that has been
refusing every enquiry since Tuesday, a task whose date passed while its owner
was away from the app.

It runs on the root domain and walks every company, so it goes through `prisma`
with an explicit `companyId` — the same shape as the ingest path, and for the
same reason: there is no session to bound it. Guarded by `CRON_SECRET` alone,
compared in constant time; **a missing secret returns 503 rather than running
unguarded**, because an unset variable is a configuration mistake, not
permission to skip the check.

Every notice carries a day-stamped key, so a retry after a failure is free and
running twice raises nothing twice. `notify` reports whether it actually created
a row, which is what keeps the matching email to exactly one.

"The form is broken" needs **both halves**: rejections piling up *and* nothing
getting through. A site taking a hundred leads and rejecting three is working; a
rate limit and a duplicate are defences doing their job and are not counted at
all.

### Addresses that aren't people

`Company.leadNotificationEmails` adds recipients to the "new lead" notice beyond
the team — a shared inbox, or an office manager with no account. Whoever does
have an account is never on this list; they choose for themselves above.

Added **one at a time and validated on the way in**, not as a comma-separated
box: a typo in the third address of a string is invisible until somebody notices
the notices stopped arriving. Anyone already receiving it as staff is dropped at
send time (`withoutStaff`), because the same lead arriving twice is how people
start ignoring the notice.

Unlike the preferences above it, this needs `settings.update`: who else in the
world receives the company's leads is not a personal choice.

## Language, money and tax

They are three different things and it is worth not mixing them:

| What | Whose | Where |
|---|---|---|
| Interface language | the user's | `User.language`, with the company as fallback |
| Number and date format | the company's | `Company.formatLocale` (e.g. `en-NZ`) |
| Currency | the company's, unless the quote says otherwise | `Company.currency` is where each quote starts; `Quote.currency` is what it kept |

The language **doesn't go in the URL**: it comes from a cookie that login
refreshes, so the subdomain proxy is left alone. A user working in Spanish sees
amounts in New Zealand format, which is the right thing.

What goes out to the customer (portal, quote emails, PDF) is in British English
and follows `Quote.language`. Internal emails to the team — "new lead received",
"your quote was opened" — do follow each user's own language.

### Picking the currency on a quote

The company's currency is a **starting value**, not a rule: a job invoiced to an
Australian customer is quoted in AUD without the company changing its own
setting. The picker sits in the totals card and the running figures beside it
follow it, so what is being typed and what it adds up to never disagree.

It is editable exactly as long as the rest of the quote is — `updateQuote`
refuses once the status is past draft. After that the currency the customer read
is frozen with everything else.

> **Amounts only add up inside one currency; counts add up across all of them.**
> "We sent eleven quotes" is true whatever they were priced in, but NZD plus AUD
> is a number that means nothing and looks exactly like one that does. So every
> report figure counts every quote and values only the ones in the company's own
> currency, and says when it left some out — a silently smaller total is the one
> kind of wrong nobody can spot. The rule is `foldByCurrency` in
> `reports/currency.ts`, kept pure so it can be checked without a database.

`Lead.currency` predates this and is still not consulted when the quote is
created: a lead that arrived marked AUD produces a quote in the company's
currency until somebody changes it on the quote. `leadPipelineSummary` also
still sums `estimatedValue` across currencies.

### Currency, format and timezone are closed lists

They were three text fields, which is how a company ends up with `NZ$` where
`NZD` belongs, or `Pacific/Aukland` with the letters swapped. Nothing complains:
the amount quietly stops formatting and every due date lands a day out.

`src/lib/intl/options.ts` is the single source, used both to **render** the
options and to **validate** what comes back — so a hand-crafted POST is checked
against exactly what the select offered, not merely for shape. `XYZ` is three
letters and passes a length check.

- **Currencies and timezones come from the platform** (`Intl.supportedValuesOf`),
  so they stay right as ICU updates and nobody maintains a list here. Currency
  labels lead with the code — typing in an open select jumps by the option's own
  text, and the three letters are what people already know.
- **Timezones are grouped by region**, because 418 in one flat list is not a
  choice anybody can make. The offset is deliberately not in the label: it moves
  with daylight saving, so half the year it would be a lie.
- **The number/date format is curated**, since there is no list to ask for —
  every language crossed with every region is valid and nearly all format alike.
  Each is labelled with a worked example (`31/01/2026 · 1,234.56`) rather than
  its tag: nobody recognises `en-NZ`, everybody recognises the date.

`components/ui/native-select.tsx` owns the one class string these share. The
shadcn `Select` next to it is Radix, carries no value in a plain form post, and
is used by nothing — which is why every screen had hand-rolled a `<select>`.

### How to add text

- Text lives in `messages/en-GB.json` and `messages/es.json`, never in the code.
- Validation schemas emit **keys**, not text (`validation.invalidEmail`); server
  actions translate them with `translateFieldErrors` before replying.
- Permission keys carry a dot (`leads.read`), and next-intl uses the dot as a
  namespace separator: in the messages they are written with an underscore
  (`permissions.leads_read`). Use `permissionMessageKey()`.
- A test fails if the two languages drift apart, if a text is left empty or if
  the interpolation placeholders don't match.

> **A missing argument fails silently, so a test reads the source for it.**
> next-intl handles a `FORMATTING_ERROR` by logging to the console and rendering
> the raw message, so the screen reads "Which emails you want from {company}"
> and the page is otherwise fine: nothing throws, the HTML carries no error, and
> the only trace is a line in a console nobody has open. It shipped on the
> settings index, where a card reused a subtitle the notifications page had
> always passed the company name to. `arguments-supplied.test.ts` pairs every
> `t("key")` with its namespace and fails if the message needs an argument the
> call doesn't give it. Checking that the two languages agree about the
> arguments never told anybody whether they were being passed.

### Tax

The type (`GST`, `HST`, `VAT`, `IVA`, `TAX`) and the rate are separate fields:
GST is 15% in New Zealand and 10% in Australia, so the type does not determine
the rate. The company proposes both and the quote keeps its own copy when issued.

## Leads: what arrived and what is done with it

`LeadSubmission` stores the form exactly as the customer sent it and is **never
edited**: the full payload plus the extracted standard fields. `Lead` is the work
on top — status, owner, notes, discard. Leads created by hand simply have no
submission.

Discarding doesn't delete: it marks `discardedAt` and keeps the reason. Every
action (assign, discard, restore, convert) is recorded in `Activity` with its
author and its time, and is translated from the type when displayed.

### The lead is the work, not the person

`Contact` is the person and persists; the lead is one piece of work and ends.
That is what lets a customer come back a year later: the new enquiry is a new
lead on the same contact, and the won one keeps its history.

Which is what lets a customer come back a year later: the new enquiry is a new
lead, and the won one keeps its history. `Contact` holds the person across all of
them. Every mature CRM draws this line — Salesforce's Opportunity, HubSpot's and
Pipedrive's Deal — because won and lost describe a piece of work and a person is
neither.

### The customer's own company

`ClientCompany` — neither `Company` nor `Account` was free: the first is the
tenant using this CRM, the second is Auth.js's OAuth link. Contacts and leads
both point at it, so a business that enquires through three different employees
over two years reads as one customer.

**It is matched on the name**, ignoring case and spacing, which is far weaker
than the email a person is matched on and is meant to be. "Scott Builders" and
"Scott Builders Ltd" stay two companies until somebody merges them: guessing
otherwise would fold two customers into one. Deleting it is `SetNull` on both
sides — deleting a grouping must not delete what was grouped.

A web enquiry finds its person on the way in (`attachContact`, inside the same
transaction as the lead). **Matching is on the email alone**: two "J. Smith"
enquiries are not evidence of the same person, and merging them would put one
customer's history on another's record. No address means no contact, and the
lead keeps the details it arrived with until somebody links it by hand.

Deleting a contact is `SetNull` on the lead: the work stays, with the details it
came with. Losing the history along with the record would be a surprising thing
for a delete button to do.

### The activity log renders stored text

`Activity.content` is written by one version of the code and read by another,
sometimes years apart. Two rules keep that from taking a page down.

**One separator, `>`.** A status change stores `FROM>TO` and nothing else. Two
writers once used a human arrow instead, so the reader split on `>`, got the
whole string as one half, and asked next-intl for
`leads.status.QUALIFIED → PROPOSAL`. Every stored row was affected, so fixing
the writers meant repairing the history in the same migration.

**A status that isn't one is shown as written.** `leadStatusName` translates only
values that are actually `LeadStatus` and passes anything else through. A line
nobody can translate is worth showing raw; it is never worth crashing over.

> **A quote being answered is not the lead's status changing.** Recording it as
> `STATUS_CHANGE` put QuoteStatus values (`SENT`, `ACCEPTED`) into a line that
> renders them as lead statuses, asking for a key that could never exist.
> `QUOTE_DECIDED` is its own type for the same reason `QUOTE_SENT` is.

Three moves are automatic, in `nextLeadStatus`:

| What happened | Where the lead goes |
|---|---|
| A quote was sent | `PROPOSAL` |
| The customer accepted | `WON` |
| Nothing is left open and the last quote was turned down | `LOST` |

Two rules hold them together. The lead only moves **forward** — a revised quote
going out to a lead in negotiation must not drag it back to proposal — and **won
is the end**, because the reports are built on that history. Lost is not an end:
a quote sent to a lost lead is someone reviving it.

`NEGOTIATION` stays manual on purpose. It is the stage where a person knows
something the system doesn't — that the customer rang asking for a discount — and
the same is true in HubSpot and Pipedrive.

**Discarding does not mark a lead lost.** They are different things: discarding
is for spam and duplicates, and `leadPipelineSummary` leaves discarded leads out
of the funnel entirely. Folding them into `LOST` would put junk into the loss
rate.

## Quotes: two pricing modes

`ITEMIZED` breaks the work into lines with quantity and unit price, for jobs that
are measured. `SECTIONS` groups the work into blocks with a title, a long
description and their own amount, which is what a trade needs where the scope is
explained in prose. A single price is a one-section quote.

The mode **only decides where the sum comes from** — discount, tax and total run
through the same `calculateQuoteTotals` in both cases.

### Prices with or without tax

`Company.pricesIncludeTax` decides whether the amounts that get typed in already
have the tax inside them. In New Zealand the Fair Trading Act requires showing
the end consumer the price with GST included; between businesses the opposite is
customary. Whichever the choice, **the breakdown always shows subtotal, tax and
total**.

When prices include it, the tax is obtained by **subtracting**
(`total − subtotal`) rather than by multiplying: that way the breakdown squares
with the total without a rounding leaving a stray cent.

### Reusing a quote: two things, not one

Quotient bundles these into one "templates" list, and the result is a list whose
entries are named after the job they came from — `Estimate For: … 1A Irene
Avenue`. It grows without bound, nobody prunes it, and every entry carries one
job's address into the next quote. They are two different intentions:

- **Duplicate** (`duplicateQuote`) is *"quote this like that one"*. Ad hoc, from
  the quote itself, nothing to configure. It hands `createQuote` the values a
  person would have typed rather than copying rows, so the numbering, its retry
  on a clash and the customer snapshot stay in one place.
- **Templates** (`QuoteTemplate`) are *"this kind of work"*. Saved off a real
  quote — which is how people actually work — but the **name is asked for**, and
  that is the whole fix: "Rockcote full replaster", not an address.

A template keeps the work and the copy; it deliberately drops the customer, the
lead, the dates and the totals. It only ever supplies **starting values** to the
form, so nothing is written until the person saves.

Templates can't be authored from scratch, only saved off a quote. That is the
trade for not maintaining a second line editor, and it keeps a template honest:
it is something the company has actually sent.

### The price list

`CatalogueItem` holds the lines a company quotes often — a product, a service, a
coat of plaster — with a unit that is free text, because every trade counts its
own way: m², hour, each.

Picking one **copies** it onto the quote. Never a reference: the quote keeps its
own price, so editing the list next month can't rewrite what a customer already
has. Same rule as everything else below.

Items are **retired, not deleted**. A quote that used one keeps its own copy
either way, so a delete would lose nothing on the quote — but it would lose the
list the company built, and there is no way back from that. Retired lines drop
out of the picker and stay findable behind a toggle.

### The four texts, and the one that was missing a default

A quote carries four pieces of prose — introduction, notes, exclusions and terms
— and the company sets a starting value for each in `/settings/company`. Terms
didn't have one until now, and the gap was invisible because every *other* layer
already treated it like its three neighbours: the template stored it, duplicating
carried it, the portal printed it. Only `createQuote` differed, saying
`terms: values.terms ?? null` where the others said `?? ctx.company.quoteX` —
not something anybody spots reading either line on its own.
`company-copy.test.ts` pins all four together, so a fifth text can't arrive half
wired.

> **The terms text and the terms PDF are different things.** `Company.quoteTerms`
> is the short paragraph printed on the quote itself, which the customer reads
> without opening anything; `CompanyDocument` is the full legal document attached
> beside it, and the portal shows both. That both were configurable-looking is
> probably how the text came to have no setting at all.

### What gets frozen on issue

Creating a quote copies: the customer's details (from the lead), the company's
texts (introduction, notes, exclusions, terms), the currency, the language, the
tax type and rate, and whether prices include it. Editing the lead or the settings
afterwards cannot change what the customer already has in their inbox.

The dashboard's sections (All, Drafts, Waiting, Active, Closed) are views over
the statuses that already exist, not new statuses.

## The three security contexts

Everything built before answered a single question: "does this user belong to
this company?". Layers 4 and 5 brought two more actors on stage:

| Guard | Who | What it enables |
|---|---|---|
| `requireCompanyContext()` | the company's team | session + membership + profile permissions |
| `resolveShare(token)` | the end customer, with no account | view and reply to **one** quote |
| `authenticateKey(token, origin)` | the web form | create a lead, nothing else |

All three lead into the same `ctx.db` bounded by company. Isolation isn't
reinvented for the new actors: what changes is who comes in, not how it is
filtered.

## Lead ingestion API

`POST /api/v1/leads` on the root domain. The key identifies the company, so the
snippet handed to each customer is identical except for their token.

- **Public key** (`nodo_pk_…`): travels in the HTML of an open site and **is not
  a secret**. It requires a domain list; the browser sends `Origin` and that
  cannot be faked from JavaScript.
- **Secret key** (`nodo_sk_…`): server to server, with no origin restriction.
- The **hash** is stored, never the token. It is shown once, when created.
- Defences: allowed domains, rate limit, honeypot field, 64 KB cap and an
  idempotency key. Rejections are mute: it is never confirmed whether a token
  exists.
- The per-IP limit is bounded **per company**: counting it globally would block
  different people behind the same NAT or mobile CGNAT against each other.

## Customer portal

`/q/<token>` on the company's subdomain, so the customer sees their branding.

- The page speaks the **quote's** language, not that of the customer's browser.
- "Viewing now" comes from a heartbeat every 20 s that updates a row; the
  dashboard polls every 15 s. No real-time infrastructure.
- **The first beat also records the opening**, and the page render does not. A
  render is not a visit: every action in the portal revalidates the page, so
  accepting a quote or sending a message logged an opening that never happened
  and bumped the counter the company reads — the one sitting beside "viewing
  now", which is real. A beat comes from a browser with the page in front of
  somebody. The trade is that a customer with JavaScript off stops being
  counted; they could never have accepted or replied either.
- **The thread keeps itself up to date** by polling every 10 s while its tab is
  visible, on both sides: `GET /api/quotes/<id>/messages` for the team and
  `GET /api/q/<token>/messages` for the customer. Both go through the same
  `formatThread`, so a message that arrives without a reload reads exactly like
  one that was there on first render. The customer's feed answers to the link
  and nothing else — revoking it stops the conversation, not just the page.
- Sending refreshes the thread as **part of the action**, not in an effect
  watching the result: two sends in a row then behave like one.
- Acceptance is configured per company (simple statement or with a checkbox,
  drawn or typed signature, comments and purchase order) and **freezes the legal
  text** when accepted.

### The link, after it has gone out

Only the hash of the token is stored, so an issued link can never be read back.
Two consequences the panel has to live with:

- **Every send adds a link; it doesn't replace the one before.** Only the hash is
  stored, so an issued token can never be read back — keeping it would let anyone
  with a database dump accept a quote in the customer's name, and accepting is a
  commercial commitment, not a read. That used to mean each send *replaced* the
  single hash, so a follow-up asking somebody to look at a quote broke the email
  that first sent it to them. `QuoteShareToken` holds several hashes against one
  share, which keeps the property that matters — they are still hashes, a dump is
  still useless — while every link handed out goes on working.
- **What closes a link lives on the share**, so revoking or expiring shuts every
  door at once. That is what revoking was always meant to mean.
- **A revoked token stays revoked**, even after a later send reopens the share.
  Sending again is somebody deliberately letting the customer back in; it must
  not also let back in whoever the link was taken away from. A company that
  revoked because the quote went to the wrong address would otherwise reopen the
  wrong person's door by fixing the address and sending again.
- **"View as customer" is a separate route** (`/quotes/<id>/preview`), not the
  customer's link. Opening the real one would beat presence, count as an opening
  and send "your quote was opened": the company would be watching itself.

Both routes render the same `QuoteDocument` from the same `companyDocumentSelect`
and `quoteDocumentInclude`, so the preview cannot drift from what the customer
opens. The preview passes `token: null`, and everything that would write —
heartbeat, acceptance, reply box — is left out rather than shown dead.

Revoking is reversible: sending again reopens the link, on purpose. The quote's
status is never touched by revoking — one whose link was closed is still a quote
that was sent.
- The four email notices go out with `after()`, outside the response. The open
  one only notifies the first time each day.

## The emails the customer gets

Sending a quote produces **two emails, to two audiences**.

The **customer** gets a notice: the company's logo, its own words, a button, the
slogan, the company's name, the validity date and the shared footer. **No prices and no
line items.** The old version embedded a copy of the figures frozen at send
time, so editing a quote and sending again left two emails in the inbox showing
different totals with nothing to say which was current. The link is now the only
source and it is never stale — and commercial figures stay out of something that
forwards in one click, where a link can at least be revoked.

The **company** gets what used to go to the customer: lines, quantities, total.
It goes to `Company.email`, or to whoever pressed Send when that is empty, so it
works before anything is configured.

> **The logo is sized twice and that is not belt and braces.** Outlook reads the
> `width` attribute and ignores the inline style; everything else does the
> reverse. `height:auto` is what keeps the proportions whichever of them wins,
> and `max-width:100%` is for the phone. A company that has uploaded no logo
> gets no image at all rather than a substitute: the initials `CompanyLogo`
> falls back to are a rendered box, and an email client is not a place to
> reproduce one.

> **The internal copy must not carry the customer's link.** The first person on
> the team to press that button counts as an opening, shows up as "the customer
> is viewing it right now" and fires the "your quote was opened" notice — the
> company watching itself. It points at `/quotes/<id>/preview`, the same document
> with nothing that writes.

Only the customer's send decides the result. The internal copy failing is a
missing archive copy, not a failed send, and a red banner over an email the
customer already has would be a lie.

### Templates: absent is the ordinary state

`EmailTemplate` is unique per `(companyId, kind)` and stores **only what a
company chose**. No row means the platform's own wording, which is translated
into every interface language while anything typed is not. That is the whole
rule for language: the company's text wins always, and empty falls back — per
field, each taken whole, never stitching half of one onto half of the other.

The reference is **appended to the subject**, so a company that configures
nothing still gets it — it is how a customer tells two of your quotes apart in
their inbox. But `{{reference}}` is also a field, and appending unconditionally
produced `New Quote: Paula Rivas - COT-000007 [COT-000007]` in a real inbox. It
is appended only when the subject doesn't already carry it.

> **Never prefill the field with the default.** It is tempting, because it shows
> what gets sent. But prefilling turns the platform's wording into that
> company's own text the moment they save, and from then on they sit out every
> improvement to it — in one language. The default goes in the `placeholder`,
> as help, never as content.

`enabled` is only meaningful for the optional ones: sending a quote *is*
emailing the customer, so `NEW_QUOTE` offers no switch. The three time-based
ones default to **off** — the first sweep after they ship would look at every
quote already sitting out there undecided, and on by default that is a night
where every customer with an old quote is chased at once by nobody's decision.

### The three that go on a calendar

Two follow-ups and a review request, carried by the nightly sweep — nobody is
going to remember to chase a quote on its third day. The company sets the three
waits; **both follow-ups count from the send**, not one from the other, so
turning the first off cannot silently move the second and the screen can say
when each goes out.

`QuoteEmail` is what makes them safe to run every night: one row per quote and
kind, with a unique key, so a retry after a failure is free and a second attempt
is impossible rather than unlikely. The quote's own send is logged there too,
which turns it into the answer to a question nobody could answer before — what
have we sent this customer, and when — shown on the quote beside the activity.

Four things stop a follow-up beyond the calendar, and each is a way of not being
the company that keeps talking after the conversation moved on: it already went,
the quote was answered, it ran out, or **the customer wrote**. Somebody who
replied "we're discussing it internally" and gets an automated reminder two days
later doesn't read diligence — they read that nobody looked at their message. A
revoked link stops it as well: chasing with a link that no longer opens is a dead
end with the company's name on it.

> **A follow-up mints a fresh link, which kills the one the first email carried.**
> There is no way around it — only the hash is stored, so an issued token can
> never be read back. It is the same property a resend already has, and this way
> the customer's most recent email is the one that works, which is the one they
> will click.

The review request asks nothing of the thread: somebody who accepted and then
asked a question is exactly who is worth asking. It does not go out at all when
the company has listed no `ReviewLink`, because an email that asks for a favour
and then doesn't say where wastes the goodwill it was sent to collect. The links
are a row per platform, added one at a time so each is checked on the way in.

### Two kinds of braces, and they must not meet

- `{name}` in `messages/*.json` is **ICU**, interpolated by next-intl.
- `{{name}}` in a stored template is a **field**, substituted by `applyFields`.

Putting `{{name}}` in a message file throws `MALFORMED_ARGUMENT`: ICU reads `{`
as the start of an argument and there is no doubling escape. So the field list on
the settings screen builds its own braces in the component — a message key
holding `{{customer}}` would take down the page that explains fields.

Field names are English, like routes: a user working in Spanish sees "Nombre del
contacto" beside `{{customer}}`, and a template still reads the same after
somebody switches their interface language.

### Who the email is from

`SenderNameStyle` stores a **shape, not a name**. Quotient keeps the literal
"Rolando Reveco" because an account there is one person; a company here is a
team, and a stored name would sign María's quote as Rolando. The name is worked
out on every send, and anything a scheduler sends falls back to the company —
there is no person behind it. The combined form uses the first name only, as
Quotient does: "Rolando from PlasterPro Solution Limited" already runs long.

The address stays `no-reply@nodo.co.nz` until each company verifies its own
domain. Whatever the shape, the name goes through `formatAddress()` — a comma in
a name would split the header into two recipients.

### The acceptance email has no button

The customer accepted from a share link whose token cannot be read back from its
hash, and the team's own route would land them on a login screen. They pressed
accept a second ago; a button that goes nowhere useful is worse than none. It
fires from both doors — the portal and the team recording a phone call — because
that is the same news either way.

## Reports

The period selector (`resolvePeriod`) is a pure function and is where the edge
cases hide: year end, leap February, the last day of a quarter. `previousPeriod`
steps back by the period's own span — the month before March is February, whatever
their lengths — and always ends exactly where the current one starts, so nothing
is counted twice or lost between the two.

### What each figure is counted on

- **Accepted and declined go by `decidedAt`**, not by when the quote was written:
  a quote sent in January and accepted in March belongs to March, which is what
  makes a monthly report square with what was actually closed that month.
- **Sent goes by `sentAt`.** It follows that sent and decided don't add up — they
  count different quotes — so they are shown as separate figures.
- **The donut holds all three**, and its percentage is accepted over all three —
  not over what was answered. That is what the reference panel does, and it keeps
  the number identical to the share of the ring the accepted segment occupies, so
  the centre can't contradict the drawing.
- **Awaiting is a stock, not a flow**: what was still open at the close of the
  period, whenever it went out.
- **The funnel is a cohort.** The leads counted at every step are the same ones.
  The alternative — this month's leads against this month's acceptances — mixes
  populations and can produce a "conversion" above 100%. The price is that a
  recent period looks worse than it will end up.
- **Times are medians.** One quote forgotten for eight months would drag a mean
  away from what the team actually experiences.
- **Growth from zero has no percentage.** `percentChange` returns null and the
  panel says so, because "+100%" there would be an invented fact.

### Each panel loads on its own

Every panel is an async component inside its own `Suspense` with a skeleton, and
the boundary's key is the query string. Changing a filter therefore shows the
skeleton again instead of leaving the previous period's figures on screen, and a
slow panel can't hold up the rest. `breakdownFor` is memoised per request —
keyed on the range as text, because React's cache compares arguments by identity
and two callers build different `Date` objects for the same instant.

### Two palettes, because the encodings differ

The **badges** (`--status-draft`, `--status-sent`, `--status-accepted`,
`--status-declined`, `--status-expired`) carry a written label beside the fill,
so they can afford green and red — which are **1.4 ΔE apart under deuteranopia**
and would be indistinguishable if colour were doing the work alone. They are
fixed values: until now "accepted" used `bg-primary`, so its colour changed with
whatever brand colour a company had picked.

In dark mode only the two neutrals move: a near-black badge on a near-black row
is invisible (1.2:1), so "expired" inverts to a light fill with dark text and
"draft" lifts enough to separate from the row.

The **chart** colours below are a separate set, and must stay that way while a
segment is identified by colour rather than by a word next to it.

The status colours (`--quote-accepted`, `--quote-awaiting`, `--quote-declined`)
are **independent of the brand colour**: "accepted" can't change meaning because
a company picks a different primary. They are validated for colour blindness
(ΔE deutan 16.3, normal vision 20.0) in light and dark, and each segment also
carries a texture so as not to depend on colour alone.

> Chart components are client components and **cannot receive functions** from
> the server. They are passed the parameters (`display`, `currency`,
> `formatLocale`) and they build the formatter themselves. The same goes for any
> `"use client"` component.

## Tables

The primitive carried almost nothing — `w-full text-sm` and a line between rows —
so every one of the seven tables in the app looked the same, because they were
all the same. What was missing was never colour: **the design system is
colour-only**, 131 tokens of it, while type size, weight, density and rhythm live
as inline classes repeated across the screens. That is where the sameness comes
from, and why it is fixed in `table.tsx` rather than screen by screen.

Three things changed in the primitive, and they reach all seven at once:

- **The header stops competing.** A tinted band, smaller, uppercase and spaced.
  It used to be the same size and weight as the data, so it read as one more row.
- **Cells stop forcing one line**, which is what lets a row carry a subject with
  an attribute under it.
- **Rows answer the pointer**, because they can be opened. The hover lives
  *inside* the selector — `[&_tr:hover]`, not `hover:[&_tr]`. The second reads as
  "when the tbody is hovered, paint every row", which lit the whole grid from any
  cell. Tailwind accepts both and they mean opposite things.

> **`TableCard` for a card that is only a table.** `Card` pads itself
> vertically, which is right with a header and wrong when the table *is* the
> card: the four listings said `p-0` on the content and still got a 24px band
> above and below, because that padding was never the content's. It also clips
> the corners, which the header band would otherwise square off. A component
> rather than a class string — that string was already written four times, and
> the fifth is how they drift.

### The row has a subject

A quote's row is *about* its title; the reference, the customer, the dates and
the total are attributes of it. So the title carries the row and the reference
sits under it — which frees a whole column and gives the row two lines to
breathe. Everything else reads quieter.

> **Most quotes have no client company** — six of eight on record. The customer
> cell has to read well without one, because that is the ordinary case and not
> the exception.

### Status as text, and what that cost

In a list, eight pills is noise, so the status is coloured text. The colour still
has the word beside it — it *is* the word — so the condition that lets these
afford green and red still holds.

But it needed a **second set of tokens**. `--status-*` were chosen to sit *under*
white text, which is a different problem: as text on the dark surface all five
land between 1.1 and 3.1 against a 4.5 minimum. `--status-*-text` are chosen
against the ground they sit on — 5.8 to 10.6 in dark — and are not the light set
lightened.

### How long ago

`elapsed` in `lib/relative-time.ts` returns a **descriptor**, not a string: the
words belong to whoever is reading and the date format to the company, and a
pure function that returned text would need both handed to it and would stop
being checkable without them. `elapsedLabel` does the phrasing.

It goes relative while that helps and **absolute after a week**. "3 days ago" is
understood without thinking; "4 weeks ago" makes the reader count backwards, and
at that distance the real date says more.

### What a row menu may do

Duplicate and view as customer, and nothing else. Duplicating is the one action
that genuinely belongs in a list — "quote this like that one" is decided while
looking down it. Sending, revoking and deleting reach a real customer or destroy
something, and in a list the row you think you are on is not always the row you
are on; those keep the quote's own page, where you can see what you are acting on.

## Rich text

Each section's scope is written with **Tiptap** (MIT; what they charge for is
their cloud, which we don't use). The mark set is short on purpose — bold,
italic, lists and links — because that content goes out in an email and in print,
where tables, colours and images look broken.

> **The HTML is sanitised on the server, always.** `sanitizeRichText()` runs on
> save and again on display. Sanitising in the browser protects nothing: the
> request can be hand-crafted, and a third party ends up seeing that content.

Everything that displays it goes through the `RichText` component. The three
render sites drifted once — the portal and the email rendered the markup while
the quote panel printed it as plain text, so the team read `<p>` tags where the
customer read a formatted scope of work. One component is what stops a fourth
site being added the wrong way.

Content written before the editor existed was plain text; `plainTextToHtml()`
converted it respecting the line breaks. The editor leaves the HTML in a hidden
field, so the form stays an ordinary form and server actions receive it without
JavaScript in between.

> **The hidden field is controlled by React, and that is not a detail.** It was
> uncontrolled once, written to imperatively by the editor. React restores an
> uncontrolled input to its `defaultValue` whenever the parent re-renders, and
> the editor fires no `update` because its own content hasn't changed — so
> writing a section's scope and *then* filling in the title emptied the field
> without touching what was on screen, and the save stored nothing. It read as a
> save that dropped the text. Anything that posts a value the user cannot see
> must hold that value where React owns it.

The editor's tests cover the scaffolding — which marks are offered, the hidden
field, the field name — but **not editing itself**: ProseMirror needs
`contenteditable` and real selections, and jsdom implements them halfway. What
is pinned instead is the failure above: the field still holds its value after
the form around it is typed into.

## The PDF comes from the browser

The download button calls `window.print()` and a print stylesheet (`@media print`
in `globals.css`) leaves the document ready for paper: interactive things out, no
section cut across two pages, links expanded. Zero dependencies and full fidelity
with what the customer sees; in exchange, the file name is theirs to choose.

Whatever must not reach the paper carries the `no-print` class.

## Confetti, and who it is for

Two moments are marked: a quote goes out, and the customer says yes. The code is
`src/lib/celebrate.ts`, and three rules shape it.

**Nobody is celebrated over.** `prefers-reduced-motion: reduce` means no confetti
at all, not a gentler version — for someone who gets motion sickness a smaller
swarm of moving particles is still a swarm of moving particles. This is the first
place in the project that honours that preference.

**Once, not once per visit.** A customer who accepts and reopens the link next
week sees the same "accepted" screen; a party every time would be absurd.
Anything carrying a `key` fires once per browser and never again. The key is also
what stops a double celebration when the team records an acceptance by hand: the
button marks it, so the page revalidating into `ACCEPTED` finds it already spent.

> **The customer and the team need different keys.** The portal is on the
> company's own subdomain — that is the point, so the customer sees the branding
> — which makes it *the same origin as the dashboard*, sharing one
> `localStorage`. Under a single key, a customer accepting spent the team's
> celebration before anybody on the team had seen it. `acceptedKey.customer()`
> and `acceptedKey.staff()` exist so the two can't be merged again by retyping
> a string.

**The team is never watching when the customer accepts.** They find out by email
or the bell and open the quote later, so the celebration hangs on the *state*
rather than on an action — `<Celebrate>` fires on the first render that finds the
quote accepted. The same component serves the customer, whose acceptance panel
unmounts the moment they accept, leaving no callback to hang anything on.

> **The preview does not celebrate.** `QuoteDocument` renders for both the
> customer and the team's own "view as customer", so the confetti is gated on
> `token` — a company throwing confetti at itself for its own quote is not a
> celebration.

Sending gets a short burst from **the button that was pressed** — its position
is read on click, since by the time the action resolves the bar may have
re-rendered away — and accepting gets the full one. A quote goes out
several times a week; what is celebrated identically every time stops being a
celebration. **Resending does not fire** — it mints a new link for a quote that
already went out, and the milestone was the first time.

`startVelocity` is the one number that decides how far the full celebration
climbs; everything else changes how much there is, not how far it goes. The first
version used 55 and the confetti died about halfway up the screen, which read as
two polite puffs rather than a celebration.

The colours are read from the live CSS tokens when it fires, so it is the
company's brand colour rather than a party shop's, and `--quote-accepted` — the
green that already means accepted everywhere else — leads the acceptance one.

> **Converting those tokens needs `oklchToHex`, not a canvas.** The tokens are
> `oklch(…)` and the library only parses hex. Assigning the string to a canvas
> context's `fillStyle` and reading it back looks like a free conversion and
> isn't: for a CSS Color 4 colour the browser returns *the same string*. Every
> OKLCH token therefore resolved to its fallback and the confetti came out in
> default blue — while `--quote-accepted`, which is plain hex, worked. A palette
> that is partly right is how this survived being looked at.
`canvas-confetti` is imported inside the function, so its chunk is fetched only
by someone about to see it; the built page carries no script tag for it.

## Choosing a file, and destroying one

> **Anything `sr-only` needs a positioned ancestor.** `sr-only` is
> `position: absolute` with no offsets, so it hangs off the nearest positioned
> ancestor — and with none, off the document. The 1×1 file input landed at the
> very bottom of the page and gave the quote several hundred pixels of empty
> scroll that nothing on screen explained; it took a DevTools inspection to find
> a one-pixel element. `Button` carries `relative` for the same reason: the
> `sr-only` labels that name an icon button would otherwise do the same.

**A native file input is hidden, never styled.** Browsers draw their own
"Choose File" chrome inside it, which reads as a text box with a word in it
rather than as something to press, and it cannot be restyled. A `<label>` or a
button pointed at a `sr-only` input is a real button, and the chosen filename
goes beside it where it can be read — a hidden input cannot say what it holds.

The name is cleared on the form's own `reset` event, not from the effect that
raises the toast: React resets the form once the action settles, so the event
says the same thing at the same moment without setting state from an effect.
Deferred by a microtask, because `reset` fires before the controls are cleared.

**Destroying something inside a list asks first**, through `ConfirmButton`. The
row you mean is not always the row your pointer is on, and the cost of a wrong
click is a file somebody has to find and upload again.

> **The question names the thing.** "Delete this?" tells you nothing you can
> check. "Delete Informe Ley 20.575.pdf?" lets you notice it is the wrong one
> while there is still time.

## How an action says what happened

Every screen posts a form to a server action and gets back the same shape, so
there is one way of announcing the result: **a snackbar**, through
`useActionToast`. Seven screens used to write it inline instead — including the
quote form, the most-used one — so saving a quote and saving a price list told
you in two different ways.

The hook exists because the effect was copied into a dozen components, which is
how the odd one out gets written in the first place.

Two settings on the `<Toaster>` are deliberate. It sits **top centre**, not top
right, because the right is where the action buttons live — Send, Accept, Save —
so a snackbar there covered the very control that had just been pressed. And it
lasts **six seconds** rather than sonner's four: half again as long is the
difference between reading it and catching that something flashed.

> **An action that succeeds has to say so.** Returning `{}` is how a save that
> worked looks exactly like one that didn't — that is what saving a lead and
> assigning its owner both did. `LeadActionState` carries a `message` for the
> same reason every other action state does.

> **Field errors stay inline.** "The title is too short" belongs beside the
> title, where it can be read while the field is being fixed; a snackbar that
> fades takes the message away mid-correction. The snackbar carries what became
> of the *action* — saved, or refused — which is one fact about the whole form.

The customer's portal is deliberately not converted. The `<Toaster>` does reach
it, since it is mounted in the root layout, but somebody without an account
reading their quote is a different context and deserves its own decision rather
than inheriting an internal habit.

## A `<select>` loses its selection when the form resets

React resets the form on its own **every time a server action settles**. A
`<select>` keeps its selection as DOM state rather than as an attribute React
re-renders, so the browser falls back to the first option; React sees that
nothing changed on its side and re-renders nothing, and the control is left
showing a value nobody picked.

It reads as a save that didn't work, and it isn't: saving a quote in AUD stored
AUD and left the picker reading **AED** — first currency alphabetically. The
record was right the whole time; only the control lied about it.

`NativeSelect` restores the selection on the form's `reset` event, deferred by a
microtask because that event fires *before* the controls are cleared — restoring
inside the handler is undone a moment later. Uncontrolled selects get the same
treatment and return to their `defaultValue` instead of to the first option,
which is what a reset was supposed to mean anyway.

> Every `<select>` in the app now goes through it — there are none written by
> hand. That is the argument for the component, more than the shared class
> string was: a hand-rolled one looks fine and carries this bug.

The component is `"use client"`, so the two filter selects on the list pages —
plain GET forms that never reset — now hydrate where they used to be static
markup. One shared control was worth that; the alternative was two components
that look identical and behave differently.

## Client components: never functions from the server

A `"use client"` component **cannot receive a function** from a Server Component.
It appears three times in this code and always with the same symptom: the whole
page fails with `__next_error__` and, if you only search the HTML for text, you
find the hydration dictionary's strings anyway and it looks like it works.

The ways out used here:

- **Formatting** → pass the parameters (`display`, `currency`, `formatLocale`)
  and let the client build the formatter, or send the text already formatted.
- **Render props** → a React context inside the client component.

When verifying a page over HTTP, check `__next_error__` before searching for any
text.

## The settings index

Cards rather than a list, and **the reason is the line of state**. A card has
room to say what is inside it; a row does not. "No lines yet" and "3 reviews"
tell somebody where there is work without opening nine screens, which is what
the old list made them do. Without that line it would be the same list with more
air, and ten tiles in a flat grid would be worse than ten rows.

**Empty is not a fault.** The states read as an invitation — italic and quiet —
because a company that signed up this morning has most of them empty and that is
normal, not a list of things it has done wrong.

**Four groups, because these are not ten peers**: the company itself, what it
quotes with, what reaches the customer, and what connects to the outside.

**The team is one of the ten, not a peer of the menu.** It had a door of its own
in the sidebar as well, from before this screen existed — which is the one thing
the index was rebuilt to stop needing. `/settings` is now the only `/settings`
route in `NAV_ITEMS`, and a test says so; on the team screen the menu lights
Settings, which is where it lives.

> **"My notifications" sits apart, and says so.** It is the only one of the ten
> that is not the company's decision but the reader's — the only one that needs
> no permission, because it is their own email. Among company settings it read
> as one more.

**Every settings screen carries the way back**, an arrow beside its title. They
are all reached from the index and none of them has anywhere else to go, but the
only way back was the sidebar's Settings — a link to the module rather than a
return to the screen you came from. The label names the destination ("Back to
Settings"), because "back" alone is not somewhere anybody can picture; a profile's
permission grid returns to Profiles, since that is what it hangs off.

`SettingsHeader` owns the title, the subtitle and the arrow together. That header
was written out eleven times identically, which is how the twelfth screen would
have arrived without an arrow.

`settingsOverview` gathers the counts in one round trip. They are `count()` on
indexed columns, but ten of them in sequence to open a menu would still be ten.

## Profiles and permissions

Profiles are **standard** (`OWNER`, `ADMIN`, `MANAGER`, `SALES`, `VIEWER`), but
each company has its own `Role` row, so it can reassign features without
affecting the others.

- Feature catalogue: `src/lib/auth/permissions.ts` (source of truth).
- Initial templates per profile: `src/lib/auth/role-templates.ts`.
- When adding a permission: add it to the catalogue, translate it in both
  languages and run `pnpm db:seed`.
- Standard profiles **don't store their name** in the database: it is null and
  translated from `key`. The field is only filled in if a company renames a
  profile.

To protect an action: `await requirePermission("quotes.send")`.

### Who may change whom

Permissions say what a profile can do; two more rules in `src/modules/team/rules.ts`
stop people locking themselves out, and both are enforced on the server rather
than only hidden in the screen.

- **Nobody edits their own membership.** An owner who demotes themselves by
  mistake loses the very screen they would undo it from. Leaving a company is a
  deliberate act and belongs elsewhere.
- **The last active owner stays one.** Suspending, removing or demoting them
  would leave a company nobody can administer, and no screen can recover from
  that.
- **The `OWNER` profile can't be trimmed**, for the same reason: it is what can
  undo a mistake made on the permission grid.

The grid submits the **whole** set of ticked features and the save replaces them
outright. A partial update would let what is stored drift from what was on
screen the moment two people edited the same profile.

### Invitations

`/join/<token>` on the company's subdomain, outside the authenticated area: the
person has no membership yet, so the token is the only thing vouching for them —
the same shape as the customer's quote link, and **only the hash is stored** for
the same reason. Re-inviting mints a new token and kills the previous link.

Accepting happens on a POST, never on the GET: a link that joined a company just
by being fetched would be accepted by the first mail scanner that previewed it.
The signed-in address has to match the invited one, or a forwarded email would
let whoever opened it walk in.

## Commands

> Migrations are created with `prisma migrate diff --from-config-datasource
> --to-schema prisma/schema.prisma --script` and applied with `migrate deploy`:
> `migrate dev` needs an interactive terminal that isn't always there.

```bash
pnpm dev -p 3100        # development
pnpm test               # unit tests
pnpm typecheck          # tsc --noEmit
pnpm lint
pnpm db:migrate         # create/apply a migration
pnpm db:seed            # permissions + demo company
pnpm db:studio
```

Locally, come in through `http://acme.localhost:3100` (the subdomain works with
nothing to configure). Demo user: `demo@nodo-crm.test` / `demo1234`.

## Domains and email

| Environment | Root domain | Company |
|---|---|---|
| Local | `localhost:3100` | `acme.localhost:3100` |
| Production | `crm.nodo.co.nz` | `acme.crm.nodo.co.nz` |

The DNS for `nodo.co.nz` is at 1stdomains.net.nz. Two records are needed:
`CNAME crm → b29c698a597c6c9f.vercel-dns-017.com.` and `A *.crm → 76.76.21.21`.

Email goes out through Resend from `no-reply@nodo.co.nz` (verified domain), with
each company's name as the visible sender: "Acme Ltd
\<no-reply@nodo.co.nz\>". That name is written by the customer at registration,
so it passes through `formatAddress()` before entering the header — without that,
a comma splits it into two addresses and an `<other@domain>` injects a foreign
sender.

Resend's free plan allows 3,000 emails a month and **100 a day**.

## Structure

```
src/
  app/
    page.tsx                  public site (root domain)
    register/                 company + owner user sign-up
    sign-in/                  entry point from the root domain
    api/
      v1/leads/               public lead ingestion API
      q/[token]/ping/         portal heartbeat
      quotes/[id]/presence/   "viewing now" for the dashboard
    s/[slug]/                 a company's subdomain
      layout.tsx              applies logo and colours
      login/  no-access/
      q/[token]/              the quote as the end customer sees it
      (app)/                  everything authenticated
        page.tsx              overview
        leads/  quotes/  reports/
        settings/             company, api, documents, notifications, reviews
  lib/
    auth/                     permissions, profiles, session
    db/                       Prisma client and isolation
    tenant/                   host resolution, company sign-up
    theme/                    brand colour → OKLCH tokens
    email/                    sending and RFC 5322 addresses
  modules/
    leads/                    schemas, service, actions, UI
    quotes/
    documents/                terms PDF, on Vercel Blob
    ingest/                   public lead API: keys, origins, limits
    portal/                   the quote as the end customer sees it
    notifications/            the four email notices
    reports/                  periods, series and charts
    settings/  team/
  i18n/                       language configuration and cookie
messages/                     en-GB.json and es.json
```

Every module follows the same pattern: `schemas.ts` (validation), `service.ts`
(data, takes `ctx`), `actions.ts` (server actions with `requirePermission`), and
its components.
