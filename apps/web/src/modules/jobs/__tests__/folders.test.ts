import { folderPaths, folderTrail, subtreeIds } from "../folders";

const folders = [
  { id: "plans", parentId: null, name: "Plans" },
  { id: "revc", parentId: "plans", name: "Rev C" },
  { id: "old", parentId: "revc", name: "Old" },
  { id: "photos", parentId: null, name: "Photos" },
];

describe("folderTrail", () => {
  it("runs from the root down to the folder", () => {
    expect(folderTrail(folders, "old").map((f) => f.id)).toEqual(["plans", "revc", "old"]);
  });

  it("is empty for a folder that isn't there", () => {
    expect(folderTrail(folders, "nope")).toEqual([]);
  });

  it("stops on a loop instead of spinning", () => {
    const looped = [
      { id: "a", parentId: "b", name: "A" },
      { id: "b", parentId: "a", name: "B" },
    ];
    expect(folderTrail(looped, "a").map((f) => f.id)).toEqual(["b", "a"]);
  });
});

describe("subtreeIds", () => {
  it("takes the folder and everything under it, and nothing beside it", () => {
    expect(subtreeIds(folders, "plans").sort()).toEqual(["old", "plans", "revc"]);
    expect(subtreeIds(folders, "photos")).toEqual(["photos"]);
  });
});

describe("folderPaths", () => {
  it("names each folder by its whole path, sorted", () => {
    expect(folderPaths(folders).map((f) => f.path)).toEqual(["Photos", "Plans", "Plans / Rev C", "Plans / Rev C / Old"]);
  });
});
