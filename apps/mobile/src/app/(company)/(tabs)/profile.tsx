import Constants from "expo-constants";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { CompanyMark } from "@/components/company-mark";
import { Screen } from "@/components/screen";
import { useAppearance } from "@/lib/appearance";
import { useMe } from "@/lib/queries";
import { useSession } from "@/lib/session";

/** Who is signed in, where, and the two ways out: another company, or signing out of this phone. */
export default function Profile() {
  const t = useTranslations("mobile");
  const { data: me } = useMe();
  const { state, leaveCompany, signOut } = useSession();
  const several = state.status === "signedIn" && (state.companies?.length ?? 2) > 1;

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerClassName="gap-section px-gutter pb-section pt-stack-loose">
        <Text accessibilityRole="header" className="text-title-1 text-foreground">
          {t("tabs.profile")}
        </Text>

        {me ? (
          <View className="gap-stack-loose rounded-xl border border-border bg-card p-card-pad">
            <View className="gap-0.5">
              <Text className="text-headline text-card-foreground">{me.user.name ?? me.user.email}</Text>
              {me.user.name ? <Text className="text-callout text-muted-foreground">{me.user.email}</Text> : null}
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row items-center gap-3">
              <CompanyMark company={me.company} />
              <View className="flex-1 gap-0.5">
                <Text className="text-label uppercase text-muted-foreground">{t("profile.company")}</Text>
                <Text className="text-callout text-card-foreground">{me.company.name}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <AppearancePicker />

        <View className="gap-stack">
          {several ? <Button label={t("profile.switchCompany")} variant="secondary" onPress={leaveCompany} /> : null}
          <Button label={t("profile.signOut")} variant="ghost" onPress={signOut} />
        </View>

        <Text className="text-center text-caption text-muted-foreground">
          {t("profile.version", { version: Constants.expoConfig?.version ?? "" })}
        </Text>
      </ScrollView>
    </Screen>
  );
}

/** Three segments: the phone's own setting, or always light, or always dark. */
function AppearancePicker() {
  const t = useTranslations("mobile.profile.appearance");
  const { choice, choose, choices } = useAppearance();

  return (
    <View className="gap-stack">
      <Text className="text-label uppercase text-muted-foreground">{t("title")}</Text>
      <View accessibilityRole="radiogroup" className="flex-row gap-1 rounded-xl border border-border bg-card p-1">
        {choices.map((option) => {
          const on = option === choice;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => choose(option)}
              className={`min-h-11 flex-1 items-center justify-center rounded-lg ${on ? "bg-muted" : "active:bg-muted"}`}
            >
              <Text className={`text-callout ${on ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{t(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
