import { describe, expect, test } from "vitest";

import { formatHttpBody } from "@/lib/format/format-http-body";

describe("formatHttpBody", () => {
  test("SM-13.4 pretty-prints JSON", () => {
    expect(formatHttpBody('{"sid":"SM1","status":"queued"}')).toEqual({
      kind: "json",
      text: '{\n  "sid": "SM1",\n  "status": "queued"\n}',
    });
  });

  test("SM-13.4 shows form bodies as decoded fields", () => {
    expect(
      formatHttpBody(
        "To=%2B8801700000000&Body=Your+code+is+482913",
        "application/x-www-form-urlencoded",
      ),
    ).toEqual({
      kind: "form",
      fields: [
        ["To", "+8801700000000"],
        ["Body", "Your code is 482913"],
      ],
    });
  });

  test("recognises a form body without a content type", () => {
    expect(formatHttpBody("api_key=a1&to=1415").kind).toBe("form");
  });

  test("falls back to text, and reports empty bodies", () => {
    expect(formatHttpBody("Internal Server Error")).toEqual({
      kind: "text",
      text: "Internal Server Error",
    });
    expect(formatHttpBody("  ")).toEqual({ kind: "empty" });
    expect(formatHttpBody("{not json").kind).toBe("text");
  });

  test("HC-01.2 shows multipart fields as rows, with file parts by name", () => {
    const multipartBody = [
      "--b1",
      'Content-Disposition: form-data; name="user_id"',
      "",
      "42",
      "--b1",
      'Content-Disposition: form-data; name="report"; filename="report.csv"',
      "Content-Type: text/csv",
      "",
      "a,b",
      "--b1--",
    ].join("\r\n");

    expect(
      formatHttpBody(multipartBody, "multipart/form-data; boundary=b1"),
    ).toEqual({
      kind: "form",
      fields: [
        ["user_id", "42"],
        ["report", "report.csv (file)"],
      ],
    });
  });
});
