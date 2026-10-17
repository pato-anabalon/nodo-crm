import {
  SIGNATURE_BOX,
  drawStrokes,
  handoffState,
  isSignaturePath,
  signatureViewBox,
  signatureDeviceFor,
  splitStrokes,
  strokeOf,
  toBox,
} from "../signature";

describe("toBox", () => {
  it("maps a point to the same place in the box whatever the canvas size", () => {
    const middle = { x: SIGNATURE_BOX.width / 2, y: SIGNATURE_BOX.height / 2 };
    const phone = { left: 0, top: 0, width: 360, height: 150 };
    const desktop = { left: 100, top: 50, width: 800, height: 333 };
    expect(toBox(180, 75, phone)).toEqual(middle);
    expect(toBox(100 + 400, 50 + 166.5, desktop)).toEqual(middle);
  });

  it("clamps a stroke that runs off the edge — the pad keeps the pointer captured", () => {
    const rect = { left: 0, top: 0, width: 600, height: 130 };
    expect(toBox(-40, 500, rect)).toEqual({ x: 0, y: SIGNATURE_BOX.height });
  });
});

describe("strokes", () => {
  it("writes and reads back the stored form", () => {
    const one = strokeOf([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(one).toBe("M1,2L3,4");
    expect(splitStrokes(`${one} M5,6L7,8`)).toEqual(["M1,2L3,4", "M5,6L7,8"]);
    expect(splitStrokes("")).toEqual([]);
  });
});

describe("drawStrokes", () => {
  it("redraws stored strokes scaled to the canvas it lands on", () => {
    const calls: string[] = [];
    const context = {
      beginPath: () => calls.push("begin"),
      moveTo: (x: number, y: number) => calls.push(`M${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`L${x},${y}`),
      stroke: () => calls.push("stroke"),
    };
    const { width, height } = SIGNATURE_BOX;
    drawStrokes(context, `M${width / 2},${height / 2}L${width},${height}`, {
      width: width * 2,
      height: height * 2,
    });
    expect(calls).toEqual(["begin", `M${width},${height}`, `L${width * 2},${height * 2}`, "stroke"]);
  });
});

describe("isSignaturePath", () => {
  it("accepts what the pads write, and nothing", () => {
    expect(isSignaturePath("M1,2L3,4 M5,6L7,8")).toBe(true);
    expect(isSignaturePath("M-1,2.5L3,4")).toBe(true);
    expect(isSignaturePath("")).toBe(true);
  });

  it("refuses anything else that could ride into an SVG", () => {
    expect(isSignaturePath('M1,2" onload="alert(1)')).toBe(false);
    expect(isSignaturePath("M1,2C3,4,5,6,7,8")).toBe(false);
    expect(isSignaturePath("<script>")).toBe(false);
    expect(isSignaturePath("L1,2")).toBe(false);
  });
});

describe("handoffState", () => {
  const now = new Date("2026-10-17T10:00:00Z");
  const live = { expiresAt: new Date("2026-10-17T10:10:00Z") };

  it("is open while the quote waits for an answer and the link opens", () => {
    expect(handoffState(live, { status: "SENT" }, true, now)).toBe("ok");
  });

  it("runs out", () => {
    expect(handoffState({ expiresAt: new Date("2026-10-17T09:59:00Z") }, { status: "SENT" }, true, now)).toBe(
      "expired",
    );
  });

  it("closes once the quote is decided or its link stops opening", () => {
    expect(handoffState(live, { status: "ACCEPTED" }, true, now)).toBe("closed");
    expect(handoffState(live, { status: "SENT" }, false, now)).toBe("closed");
  });
});

describe("signatureDeviceFor", () => {
  it("is the phone's only when what was accepted is exactly what it sent", () => {
    expect(signatureDeviceFor("M1,2L3,4", "M1,2L3,4")).toBe("TOUCH_DEVICE");
  });

  it("is this device's once drawn over, or with nothing from a phone", () => {
    expect(signatureDeviceFor("M1,2L3,4 M9,9L8,8", "M1,2L3,4")).toBe("THIS_DEVICE");
    expect(signatureDeviceFor("M1,2L3,4", null)).toBe("THIS_DEVICE");
    expect(signatureDeviceFor("", "")).toBe("THIS_DEVICE");
  });
});

describe("signatureViewBox", () => {
  it("frames a signature by its own strokes, whichever box it was drawn in", () => {
    // An older one, drawn in the 600×130 box.
    expect(signatureViewBox("M100,40L300,90")).toBe("90 30 220 70");
  });

  it("doesn't blow a dot up to fill the frame", () => {
    expect(signatureViewBox("M100,40L101,40")).toBe("90 30 60 40");
  });

  it("falls back to the whole box with nothing drawn", () => {
    expect(signatureViewBox("")).toBe(`0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`);
  });
});
