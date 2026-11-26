import { distanceM, type Point } from "../geofence";
import { decodeTrack, encodeTrack, simplifyTrack, thinTrack, trackRuns } from "../track";

const p = (latitude: number, longitude: number): Point => ({ latitude, longitude });

describe("encodeTrack / decodeTrack", () => {
  it("writes Google's own encoding", () => {
    // The worked example in Google's documentation.
    expect(encodeTrack([p(38.5, -120.2), p(40.7, -120.95), p(43.252, -126.453)])).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("reads back what it wrote, to about a metre", () => {
    const points = [p(-36.84846, 174.76333), p(-36.85012, 174.7651), p(-36.86001, 174.77802)];
    const back = decodeTrack(encodeTrack(points));
    expect(back).toHaveLength(3);
    back.forEach((point, i) => expect(distanceM(point, points[i]!)).toBeLessThan(1.5));
  });

  it("gives what it could read from a broken string, and nothing from rubbish", () => {
    const whole = encodeTrack([p(-36.8, 174.7), p(-36.9, 174.8)]);
    expect(decodeTrack(whole.slice(0, -1))).toHaveLength(1);
    expect(decodeTrack(" ")).toEqual([]);
  });
});

describe("simplifyTrack", () => {
  it("drops the positions a straight line already explains", () => {
    const line = Array.from({ length: 50 }, (_, i) => p(-36.85 + i * 0.0001, 174.76));
    expect(simplifyTrack(line)).toEqual([line[0], line[49]]);
  });

  it("keeps the corner of a turn", () => {
    const leg = Array.from({ length: 20 }, (_, i) => p(-36.85 + i * 0.0001, 174.76));
    const across = Array.from({ length: 20 }, (_, i) => p(-36.85 + 19 * 0.0001, 174.76 + (i + 1) * 0.0001));
    const kept = simplifyTrack([...leg, ...across]);
    expect(kept).toHaveLength(3);
    expect(kept[1]).toEqual(leg[19]);
  });

  it("ignores wobble under the tolerance", () => {
    // ±5 m either side of a line north.
    const wobbly = Array.from({ length: 40 }, (_, i) => p(-36.85 + i * 0.0002, 174.76 + (i % 2 ? 0.00005 : -0.00005)));
    expect(simplifyTrack(wobbly).length).toBeLessThanOrEqual(3);
  });

  it("leaves one or two positions alone", () => {
    expect(simplifyTrack([])).toEqual([]);
    expect(simplifyTrack([p(1, 1)])).toEqual([p(1, 1)]);
  });
});

describe("thinTrack", () => {
  it("is null with nothing to draw, and a short string for a day of positions", () => {
    expect(thinTrack([])).toBeNull();
    const day = Array.from({ length: 150 }, (_, i) => p(-36.85 + Math.sin(i / 10) * 0.002, 174.76 + i * 0.00005));
    const line = thinTrack(day)!;
    expect(line.length).toBeLessThan(600);
    expect(decodeTrack(line)[0]).toEqual(p(-36.85, 174.76));
  });
});

describe("trackRuns", () => {
  const site = { ...p(-33.1651673, -70.7898245), radiusM: 50 };
  // About 111 m north per 0.001° of latitude.
  const north = (metres: number) => p(site.latitude + metres / 111_195, site.longitude);

  it("draws the way out and back as away, sharing the points where the runs meet", () => {
    const [a, b, c, d, e] = [north(10), north(30), north(80), north(135), north(20)];
    expect(trackRuns([a, b, c, d, e], site)).toEqual([
      { away: false, points: [a, b] },
      { away: true, points: [b, c, d, e] },
      { away: false, points: [e] },
    ]);
  });

  it("is all on the job when the job has no place", () => {
    expect(trackRuns([north(10), north(500)], null)).toEqual([{ away: false, points: [north(10), north(500)] }]);
  });

  it("is nothing for no positions", () => {
    expect(trackRuns([], site)).toEqual([]);
  });
});
