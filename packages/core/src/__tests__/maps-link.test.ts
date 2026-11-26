import { googleMapsUrl } from "../maps-link";

it("opens the pin's coordinates in Google Maps", () => {
  expect(googleMapsUrl({ latitude: -36.8485, longitude: 174.7633 })).toBe(
    "https://www.google.com/maps/search/?api=1&query=-36.848500%2C174.763300",
  );
});
