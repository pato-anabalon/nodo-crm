import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { ErrorText, Screen, Title } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { errorKey, useErrorText } from "@/lib/errors";
import { useSession } from "@/lib/session";

/**
 * The six digits from the email. The phone offers them from the message
 * (`oneTimeCode`), and trusting it — on by default, since a worker signs in
 * every morning — skips this for 30 days.
 */
export default function Code() {
  const t = useTranslations("mobile.codeScreen");
  const errorText = useErrorText();
  const { state, verifyCode, restart } = useSession();
  const track = useColor("primary");

  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (state.status !== "code") return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await verifyCode(code, trust);
    } catch (caught) {
      setError(caught);
      setBusy(false);
      // A used-up or expired code can't be retried; only a wrong one can.
      if (errorKey(caught) === "invalid_code") setCode("");
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="grow justify-center gap-section px-gutter py-section" keyboardShouldPersistTaps="handled">
          <Title subtitle={t("body", { email: state.email })}>{t("title")}</Title>
          <View className="gap-stack-loose">
            <Field
              label={t("label")}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={() => code.length === 6 && submit()}
            />
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: trust }}
              onPress={() => setTrust(!trust)}
              className="min-h-12 flex-row items-center justify-between gap-stack"
            >
              <Text className="flex-1 text-callout text-foreground">{t("trust")}</Text>
              <Switch value={trust} onValueChange={setTrust} trackColor={{ true: track }} />
            </Pressable>
            <ErrorText>{error ? errorText(error) : null}</ErrorText>
          </View>
          <View className="gap-stack">
            <Button label={busy ? t("submitting") : t("submit")} busy={busy} disabled={code.length !== 6} onPress={submit} />
            <Button label={t("restart")} variant="ghost" onPress={restart} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
