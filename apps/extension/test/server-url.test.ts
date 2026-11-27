import { describe, expect, it } from "vitest";
import { normalizeServerUrl } from "../utils/server-url";

describe("Heard server URL", () => {
  it("accepts encrypted remote servers and local development servers", () => {
    expect(normalizeServerUrl(" https://heard.example.com/app/ ")).toBe("https://heard.example.com/app");
    expect(normalizeServerUrl("http://localhost:3100/")).toBe("http://localhost:3100");
    expect(normalizeServerUrl("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100");
  });

  it("rejects remote HTTP, embedded credentials, and URL parameters", () => {
    expect(normalizeServerUrl("http://heard.example.com")).toBeNull();
    expect(normalizeServerUrl("http://localhost.evil.example")).toBeNull();
    expect(normalizeServerUrl("https://user:secret@heard.example.com")).toBeNull();
    expect(normalizeServerUrl("https://heard.example.com/?key=secret")).toBeNull();
  });
});
