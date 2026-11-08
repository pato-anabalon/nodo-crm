import { hexToOklch, oklchToHex } from "@nodo/core/theme/color";
import { Image } from "expo-image";
import { Text, View } from "react-native";

type Company = { name: string; logoUrl: string | null; primaryColor: string };

/**
 * The logo, or the initials on the company's colour — what the web's
 * `CompanyLogo` falls back to. The initials take whichever of black or white
 * reads on that colour, as a button in the company's colour does.
 */
export function CompanyMark({ company, size = 40 }: { company: Company; size?: number }) {
  const box = { width: size, height: size, borderRadius: 8 };

  if (company.logoUrl) {
    return <Image source={company.logoUrl} style={box} contentFit="contain" accessibilityIgnoresInvertColors />;
  }

  const brand = hexToOklch(company.primaryColor);
  const ink = brand ? (oklchToHex(brand.readableForeground) ?? "#ffffff") : "#ffffff";
  const initials = company.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <View style={[box, { backgroundColor: company.primaryColor }]} className="items-center justify-center">
      <Text style={{ color: ink }} className="text-callout font-semibold">
        {initials}
      </Text>
    </View>
  );
}
