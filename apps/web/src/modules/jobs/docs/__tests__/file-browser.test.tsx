import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { FileBrowser, type BrowserFile, type BrowserFolder } from "../file-browser";

const noop = jest.fn(async () => ({}));

const folder: BrowserFolder = {
  id: "f1",
  name: "Site photos",
  href: "/jobs/j1/docs/f1",
  contents: "4 files · 2 folders",
  canUpdate: true,
  canDelete: true,
};

const file: BrowserFile = {
  id: "a1",
  folderId: null,
  name: "Informe de inspección estructural del cielo raso - revisión final v7.pdf",
  url: "https://example.test/a1.pdf",
  kind: "pdf",
  extension: "pdf",
  sizeLabel: "2.1 MB",
  dateLabel: "13 Oct 2026",
  thumbnailUrl: null,
  width: null,
  height: null,
  uploadedBy: { id: "u1", name: "Ana", email: "ana@example.test", image: null },
  canUpdate: true,
  canDelete: true,
};

function renderList() {
  return renderWithIntl(
    <FileBrowser
      folders={[folder]}
      files={[file]}
      view="list"
      emptyLabel="Nothing here"
      moveTargets={[]}
      onRenameFile={noop}
      onMoveFile={noop}
      onDeleteFile={noop}
      onRenameFolder={noop}
      onDeleteFolder={noop}
    />,
  );
}

/**
 * jsdom draws no layout, so what is checked is the cause: the name's cell is the
 * one allowed to shrink (`max-w-0` with `w-full`), and what a phone would lose —
 * size, date, who — is written under the name instead of vanishing.
 */
describe("FileBrowser — list view", () => {
  it("lets the name's cell shrink, so a long file name truncates instead of widening the table", () => {
    const { container } = renderList();

    const nameCells = [...container.querySelectorAll("tbody tr")].map((row) => row.querySelector("td"));
    for (const cell of nameCells) {
      expect(cell?.className).toContain("max-w-0");
      expect(cell?.className).toContain("w-full");
    }
    expect(screen.getByText(file.name).className).toContain("truncate");
  });

  it("writes the size, the date and who uploaded it under a file's name for a phone", () => {
    renderList();

    const line = screen.getByText("2.1 MB · 13 Oct 2026 · Ana");
    expect(line.className).toContain("sm:hidden");
  });

  it("writes a folder's contents under its name for a phone, and keeps the column from there up", () => {
    renderList();

    const phoneLine = screen.getAllByText(folder.contents).find((el) => el.className.includes("sm:hidden"));
    const column = screen.getAllByText(folder.contents).find((el) => el.tagName === "TD");
    expect(phoneLine).toBeDefined();
    expect(column?.className).toContain("sm:table-cell");
    expect(column?.className).toContain("hidden");
  });

  it("still opens each row's menu", () => {
    renderList();
    expect(
      within(screen.getAllByRole("row")[2]!).getByRole("button", { name: /Actions for/ }),
    ).toBeInTheDocument();
  });
});
