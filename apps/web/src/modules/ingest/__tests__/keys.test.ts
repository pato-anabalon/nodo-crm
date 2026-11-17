import { IngestKeyType } from "@/generated/prisma/enums";
import {
  generateIngestKey,
  hashIngestKey,
  hashesMatch,
  keyTypeFromToken,
  readToken,
} from "../keys";

describe("generateIngestKey", () => {
  it("marks the type in the token's prefix", () => {
    expect(generateIngestKey(IngestKeyType.PUBLIC).token.startsWith("nodo_pk_")).toBe(true);
    expect(generateIngestKey(IngestKeyType.SECRET).token.startsWith("nodo_sk_")).toBe(true);
  });

  it("stores a prefix that identifies without revealing the secret", () => {
    const key = generateIngestKey(IngestKeyType.PUBLIC);

    expect(key.token.startsWith(key.prefix)).toBe(true);
    expect(key.prefix.length).toBeLessThan(key.token.length);
    // The prefix alone can't be used to rebuild the token.
    expect(hashIngestKey(key.prefix)).not.toBe(key.hashedSecret);
  });

  it("the stored hash matches the full token", () => {
    const key = generateIngestKey(IngestKeyType.SECRET);
    expect(key.hashedSecret).toBe(hashIngestKey(key.token));
  });

  it("never repeats a token", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateIngestKey(IngestKeyType.PUBLIC).token),
    );
    expect(tokens.size).toBe(200);
  });

  it("the token carries enough entropy", () => {
    const { token } = generateIngestKey(IngestKeyType.PUBLIC);
    expect(token.length).toBeGreaterThan(38);
  });
});

describe("keyTypeFromToken", () => {
  it("tells public apart from secret", () => {
    expect(keyTypeFromToken("nodo_pk_abc")).toBe(IngestKeyType.PUBLIC);
    expect(keyTypeFromToken("nodo_sk_abc")).toBe(IngestKeyType.SECRET);
  });

  it("returns null for a token that is not ours", () => {
    expect(keyTypeFromToken("sk_live_stripe")).toBeNull();
    expect(keyTypeFromToken("")).toBeNull();
  });
});

describe("hashesMatch", () => {
  it("compares equal and differing hashes", () => {
    const hash = hashIngestKey("nodo_pk_abc");
    expect(hashesMatch(hash, hash)).toBe(true);
    expect(hashesMatch(hash, hashIngestKey("nodo_pk_otro"))).toBe(false);
  });

  it("does not blow up on differing lengths", () => {
    expect(hashesMatch("corto", "muchísimo más largo")).toBe(false);
  });
});

describe("readToken", () => {
  it("reads the token from Authorization Bearer", () => {
    const headers = new Headers({ authorization: "Bearer nodo_pk_abc" });
    expect(readToken(headers)).toBe("nodo_pk_abc");
  });

  it("accepts X-Api-Key too", () => {
    expect(readToken(new Headers({ "x-api-key": "nodo_pk_abc" }))).toBe("nodo_pk_abc");
  });

  it("Authorization tiene prioridad", () => {
    const headers = new Headers({
      authorization: "Bearer nodo_pk_uno",
      "x-api-key": "nodo_pk_dos",
    });
    expect(readToken(headers)).toBe("nodo_pk_uno");
  });

  it("returns null when there is no token or it comes empty", () => {
    expect(readToken(new Headers())).toBeNull();
    expect(readToken(new Headers({ authorization: "Bearer " }))).toBeNull();
    expect(readToken(new Headers({ authorization: "Basic abc" }))).toBeNull();
  });
});
