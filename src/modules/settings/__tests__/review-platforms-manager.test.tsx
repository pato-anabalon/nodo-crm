import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/test/intl";
import { ReviewPlatformsManager } from "../review-platforms-manager";

function renderManager(platforms: Parameters<typeof ReviewPlatformsManager>[0]["platforms"] = []) {
  renderWithIntl(
    <ReviewPlatformsManager
      platforms={platforms}
      canManage
      save={jest.fn(async () => ({}))}
      remove={jest.fn(async () => ({}))}
    />,
  );
}

describe("ReviewPlatformsManager", () => {
  it("asks for a name once the platform is somewhere else", async () => {
    const user = userEvent.setup();
    renderManager();

    expect(screen.queryByLabelText("Platform name")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Platform"), "OTHER");
    expect(screen.getByLabelText("Platform name")).toBeInTheDocument();
  });

  it("only offers the platforms not listed yet", () => {
    renderManager([
      { id: "a", source: "GOOGLE", label: null, readUrl: "https://g.test", leaveUrl: null },
    ]);
    const options = Array.from(
      (screen.getByLabelText("Platform") as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(options).not.toContain("GOOGLE");
    expect(options).toContain("NOCOWBOYS");
  });

  it("shows both links of a platform side by side, and says which is missing", () => {
    renderManager([
      {
        id: "a",
        source: "NOCOWBOYS",
        label: null,
        readUrl: "https://www.nocowboys.co.nz/businesses/x#ratings",
        leaveUrl: null,
      },
    ]);
    expect(screen.getByText("https://www.nocowboys.co.nz/businesses/x#ratings")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("fixes the platform while editing, so a save corrects the row instead of adding one", async () => {
    const user = userEvent.setup();
    renderManager([
      { id: "a", source: "GOOGLE", label: null, readUrl: "https://g.test", leaveUrl: null },
    ]);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Platform")).toBeDisabled();
    expect(screen.getByLabelText("Link to read reviews")).toHaveValue("https://g.test");
  });
});
