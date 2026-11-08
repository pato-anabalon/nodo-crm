import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { ErrorText, Screen, Title } from "@/components/screen";
import { useErrorText, useFieldError } from "@/lib/errors";
import { useSession } from "@/lib/session";

/** The web's email and password. A trusted phone goes straight in; any other gets a code by email. */
export default function SignIn() {
  const t = useTranslations("mobile.signIn");
  const errorText = useErrorText();
  const fieldError = useFieldError();
  const { signIn } = useSession();
  const password = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), secret);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  const emailError = fieldError(error, "email");
  const passwordError = fieldError(error, "password");

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="grow justify-center gap-section px-gutter py-section" keyboardShouldPersistTaps="handled">
          <Title subtitle={t("subtitle")}>{t("title")}</Title>
          <View className="gap-stack-loose">
            <Field
              label={t("email")}
              value={email}
              onChangeText={setEmail}
              error={emailError}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => password.current?.focus()}
            />
            <Field
              ref={password}
              label={t("password")}
              value={secret}
              onChangeText={setSecret}
              error={passwordError}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {/* Field errors say themselves beside the field; this is what became of the attempt. */}
            {error && !emailError && !passwordError ? <ErrorText>{errorText(error)}</ErrorText> : null}
          </View>
          <Button label={busy ? t("submitting") : t("submit")} busy={busy} disabled={!email || !secret} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
