type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Validation schemas emit message keys, not text: they run on the server and
 * don't know what language whoever submitted the form works in. Server actions
 * translate them right before responding.
 *
 * A key can carry values: `validation.maxChars|max=2000`.
 */
export function translateIssue(key: string, t: Translator): string {
  const [path, rawValues] = key.split("|");

  const values: Record<string, string> = {};
  if (rawValues) {
    for (const pair of rawValues.split(",")) {
      const [name, value] = pair.split("=");
      if (name && value !== undefined) values[name] = value;
    }
  }

  try {
    return t(path, values);
  } catch {
    // If the key doesn't exist, showing the key beats breaking the form.
    return path;
  }
}

export function translateFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
  t: Translator,
): Record<string, string[]> {
  const translated: Record<string, string[]> = {};
  for (const [field, issues] of Object.entries(fieldErrors)) {
    if (!issues?.length) continue;
    translated[field] = issues.map((issue) => translateIssue(issue, t));
  }
  return translated;
}
