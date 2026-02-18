import { describe, it, expect } from "vitest";
import { truncateText, compactContent } from "./smart-compact";

const longMultiline = (lines: number, lineLen = 100) =>
  Array.from({ length: lines }, (_, i) => "x".repeat(lineLen) + i).join("\n");

describe("truncateText", () => {
  it("short text returns unchanged", () => {
    expect(truncateText("hello", 8000)).toBe("hello");
  });

  it("few lines but long chars returns unchanged", () => {
    const text = "x".repeat(9000) + "\n" + "y".repeat(9000);
    expect(truncateText(text, 8000)).toBe(text);
  });

  it("long text with many lines gets truncated", () => {
    const text = longMultiline(200);
    const result = truncateText(text, 8000);
    expect(result).toContain("[...truncated");
  });

  it("preserves head and tail", () => {
    const text = longMultiline(200);
    const result = truncateText(text, 8000);
    expect(result.startsWith(text.slice(0, 1500))).toBe(true);
    expect(result.endsWith(text.slice(-2500))).toBe(true);
  });

  it("custom head/tail params work", () => {
    const text = longMultiline(200);
    const result = truncateText(text, 100, 50, 50);
    expect(result).toContain("[...truncated");
    expect(result.startsWith(text.slice(0, 50))).toBe(true);
    expect(result.endsWith(text.slice(-50))).toBe(true);
  });
});

describe("compactContent", () => {
  it("short string returns unchanged", () => {
    expect(compactContent("short")).toBe("short");
  });

  it("long string gets truncated", () => {
    const text = longMultiline(200);
    expect(compactContent(text)).toContain("[...truncated");
  });

  it("array text block gets truncated", () => {
    const text = longMultiline(200);
    const result = compactContent([{ type: "text", text }]);
    expect(result[0].text).toContain("[...truncated");
  });

  it("array non-text block returned unchanged", () => {
    const block = { type: "image", url: "x" };
    expect(compactContent([block])).toEqual([block]);
  });

  it("non-array non-string returned as-is", () => {
    expect(compactContent(42)).toBe(42);
    expect(compactContent({ a: 1 })).toEqual({ a: 1 });
  });
});
