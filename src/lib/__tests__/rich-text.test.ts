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

describe("sanitizeRichText, full profile", () => {
  const full = (html: string) => sanitizeRichText(html, "full");

  it("keeps headings, tables, alignment and the palette's colours", () => {
    const html =
      '<h2 style="text-align:center">Day 3</h2>' +
      '<p>Walls <span style="color:#c92a2a">not dry</span>, <mark style="background-color:#fff3bf">check Monday</mark></p>' +
      '<table><tbody><tr><th colspan="2">Room</th></tr><tr><td>Lounge</td><td>Done</td></tr></tbody></table>';
    const result = full(html);
    expect(result).toContain('<h2 style="text-align:center">');
    expect(result).toContain('<span style="color:#c92a2a">');
    expect(result).toContain('<mark style="background-color:#fff3bf">');
    expect(result).toContain('<th colspan="2">');
  });

  it("accepts a palette colour the way a browser writes it back", () => {
    expect(full('<p><span style="color: rgb(201, 42, 42)">x</span></p>')).toContain("rgb(201, 42, 42)");
  });

  it("drops a colour that isn't in the palette, and every other property", () => {
    const result = full(
      '<p style="position:fixed;text-align:left"><span style="color:#00ff00;background:url(https://evil.example/x.png)">x</span></p>',
    );
    expect(result).not.toContain("#00ff00");
    expect(result).not.toContain("url(");
    expect(result).not.toContain("position");
    expect(result).toContain("text-align:left");
  });

  it("keeps the highlight's text dark by dropping the editor's colour: inherit", () => {
    expect(full('<mark style="background-color:#fff3bf;color:inherit">x</mark>')).toBe(
      '<mark style="background-color:#fff3bf">x</mark>',
    );
  });

  it("refuses a cell span that would blow the table out", () => {
    const result = full('<table><tbody><tr><td colspan="5000" rowspan="2">x</td></tr></tbody></table>');
    expect(result).not.toContain("5000");
    expect(result).toContain('rowspan="2"');
  });

  it("still refuses images, scripts and handlers", () => {
    const result = full('<p onclick="x()">a</p><img src="a.png"><script>alert(1)</script>');
    expect(result).toBe("<p>a</p>");
  });

  it("leaves the quote's profile exactly as it was", () => {
    const html = '<h2>x</h2><p style="text-align:center"><span style="color:#c92a2a">y</span></p><table><tr><td>z</td></tr></table>';
    expect(sanitizeRichText(html)).toBe("x<p>y</p>z");
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
