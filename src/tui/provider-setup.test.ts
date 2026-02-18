import { describe, it, expect } from "vitest";
import { isUnsafeUrl } from "./provider-setup.js";

describe("isUnsafeUrl", () => {
  it("https remote is safe", () => {
    expect(isUnsafeUrl("https://api.example.com")).toBe(false);
  });

  it("http localhost is safe", () => {
    expect(isUnsafeUrl("http://localhost:11434")).toBe(false);
  });

  it("http 127.0.0.1 is safe", () => {
    expect(isUnsafeUrl("http://127.0.0.1:8080")).toBe(false);
  });

  it("http [::1] is blocked (contains colon in hostname)", () => {
    expect(isUnsafeUrl("http://[::1]:8080")).toBe(true);
  });

  it("10.x private is unsafe", () => {
    expect(isUnsafeUrl("https://10.0.0.1/api")).toBe(true);
  });

  it("172.16.x private is unsafe", () => {
    expect(isUnsafeUrl("https://172.16.0.1/api")).toBe(true);
  });

  it("192.168.x private is unsafe", () => {
    expect(isUnsafeUrl("https://192.168.1.1/api")).toBe(true);
  });

  it("http remote is unsafe", () => {
    expect(isUnsafeUrl("http://api.example.com")).toBe(true);
  });

  it("0.0.0.0 is unsafe", () => {
    expect(isUnsafeUrl("https://0.0.0.0")).toBe(true);
  });

  it("169.254.x link-local is unsafe", () => {
    expect(isUnsafeUrl("https://169.254.1.1")).toBe(true);
  });

  it("invalid url is unsafe", () => {
    expect(isUnsafeUrl("not-a-url")).toBe(true);
  });

  it("empty string is unsafe", () => {
    expect(isUnsafeUrl("")).toBe(true);
  });
});
