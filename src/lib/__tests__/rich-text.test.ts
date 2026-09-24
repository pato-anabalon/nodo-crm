import {
  isRichTextEmpty,
  plainTextToHtml,
  richTextToPlain,
  sanitizeRichText,
} from "../rich-text";

describe("sanitizeRichText", () => {
  it("keeps the formatting the editor does allow", () => {
    const html = "<p>Scope of <strong>work</strong></p><ul><li>Rockcote</li><li>Resene</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("strips the script and keeps the text", () => {
    expect(sanitizeRichText('<p>Hola</p><script>alert("xss")</script>')).toBe("<p>Hola</p>");
  });

  it("strips the event handlers", () => {
    expect(sanitizeRichText('<p onclick="evil()">Hola</p>')).toBe("<p>Hola</p>");
  });

  it("discards a javascript: link", () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">clic</a>');
    expect(result).not.toContain("javascript:");
    expect(result).toContain("clic");
  });

  it("lets normal links through and gives them noopener", () => {
    const result = sanitizeRichText('<a href="https://resene.co.nz">Resene</a>');
    expect(result).toContain('href="https://resene.co.nz"');
    expect(result).toContain('rel="noopener noreferrer nofollow"');
    expect(result).toContain('target="_blank"');
  });

  it("accepts mailto and tel, which do belong in a quote", () => {
    expect(sanitizeRichText('<a href="mailto:a@b.cl">correo</a>')).toContain("mailto:");
    expect(sanitizeRichText('<a href="tel:+64211234567">llamar</a>')).toContain("tel:");
  });

  it("discards the tags that would break the email", () => {
    const result = sanitizeRichText("<table><tr><td>x</td></tr></table><img src='a.png'>");
    expect(result).not.toContain("<table");
    expect(result).not.toContain("<img");
  });

  it("does not fall over on empty input", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText("")).toBe("");
  });
});

describe("isRichTextEmpty", () => {
  it("an empty paragraph from the editor counts as empty", () => {
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p>&nbsp;</p>")).toBe(true);
  });

  it("with real text it is not empty", () => {
    expect(isRichTextEmpty("<p>Scope of work</p>")).toBe(false);
  });
});

describe("plainTextToHtml", () => {
  it("a blank line separates paragraphs", () => {
    expect(plainTextToHtml("Primero\n\nSegundo")).toBe("<p>Primero</p><p>Segundo</p>");
  });

  it("a single break is a line break", () => {
    expect(plainTextToHtml("Rockcote\nResene")).toBe("<p>Rockcote<br>Resene</p>");
  });

  it("escapes what could inject markup", () => {
    expect(plainTextToHtml("a < b & c")).toBe("<p>a &lt; b &amp; c</p>");
  });

  it("empty text produces no markup", () => {
    expect(plainTextToHtml("   ")).toBe("");
    expect(plainTextToHtml(null)).toBe("");
  });
});

describe("richTextToPlain", () => {
  it("lists keep their bullet", () => {
    expect(richTextToPlain("<ul><li>Rockcote</li><li>Resene</li></ul>")).toBe("• Rockcote\n• Resene");
  });

  it("paragraphs end up separated", () => {
    expect(richTextToPlain("<p>Uno</p><p>Dos</p>")).toBe("Uno\n\nDos");
  });

  it("returns entities to their character", () => {
    expect(richTextToPlain("<p>a &lt; b &amp; c</p>")).toBe("a < b & c");
  });

  it("a round trip preserves the text", () => {
    const original = "Primero\n\nSegundo";
    expect(richTextToPlain(plainTextToHtml(original))).toBe(original);
  });
});
