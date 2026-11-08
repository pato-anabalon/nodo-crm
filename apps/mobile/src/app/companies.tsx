import { ChevronRight } from "lucide-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { CompanyMark } from "@/components/company-mark";
import { Empty, Loading, Screen, Title } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { useSession } from "@/lib/session";
import type { CompanyChoice } from "@/lib/types";

/** Where this person can work today. Each row carries the company's own mark, which is how people recognise it. */
export default function Companies() {
  const t = useTranslations("mobile");
  const { state, chooseCompany, signOut } = useSession();
  if (state.status !== "signedIn") return null;

  return (
    <Screen>
      <View className="flex-1 gap-section px-gutter pt-section">
        <Title subtitle={t("companies.subtitle")}>{t("companies.title")}</Title>
        {state.companies === null ? (
          <Loading />
        ) : (
          <FlatList
            data={state.companies}
            keyExtractor={(company) => company.slug}
            contentContainerClassName="gap-stack"
            ListEmptyComponent={<Empty text={t("errors.no_access")} />}
            renderItem={({ item }) => <CompanyRow company={item} onPress={() => chooseCompany(item.slug)} />}
          />
        )}
        <View className="pb-stack-loose">
          <Button label={t("profile.signOut")} variant="ghost" onPress={signOut} />
        </View>
      </View>
    </Screen>
  );
}

function CompanyRow({ company, onPress }: { company: CompanyChoice; onPress: () => void }) {
  const chevron = useColor("muted-foreground");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-16 flex-row items-center gap-stack-loose rounded-xl border border-border bg-card px-card-pad py-stack active:opacity-80"
    >
      <CompanyMark company={company} />
      <Text className="flex-1 text-headline text-card-foreground" numberOfLines={2}>
        {company.name}
      </Text>
      <ChevronRight size={20} color={chevron} />
    </Pressable>
  );
}
