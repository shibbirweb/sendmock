#!/usr/bin/env bun
/**
 * Failed Rust tests as GitHub annotations, so a failure shows its name and message on the
 * pull request without reading the job log.
 *
 *     bun scripts/nextest-failures.ts target/nextest/default/junit.xml
 *
 * Reads the JUnit report nextest writes (`.config/nextest.toml`) and prints one `::error`
 * workflow command per failed test with the end of its output.
 */

import { existsSync, readFileSync } from "node:fs";

/** The most output kept per test; annotations show a few kilobytes at most. */
const maximumOutputCharacters = 1800;

export type FailedTest = {
  testName: string;
  output: string;
};

function decodeXmlText(xmlText: string): string {
  return xmlText
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function readElementText(testcaseXml: string, elementName: string): string {
  const elementPattern = new RegExp(
    `<${elementName}[^>]*>([\\s\\S]*?)</${elementName}>`,
  );
  return decodeXmlText(testcaseXml.match(elementPattern)?.[1] ?? "");
}

/** Each test case with a `<failure>` or `<error>`, with the end of what it printed. */
export function readFailedTests(junitXml: string): FailedTest[] {
  const testcasePattern =
    /<testcase\b[^>]*\bname="([^"]*)"[^>]*\bclassname="([^"]*)"[^>]*>([\s\S]*?)<\/testcase>/g;
  return [...junitXml.matchAll(testcasePattern)]
    .filter(([, , , testcaseXml]) => /<(failure|error)\b/.test(testcaseXml ?? ""))
    .map(([, testName, className, testcaseXml]) => {
      const output = [
        readElementText(testcaseXml ?? "", "failure"),
        readElementText(testcaseXml ?? "", "system-out"),
        readElementText(testcaseXml ?? "", "system-err"),
      ]
        .filter((outputPart) => outputPart.trim() !== "")
        .join("\n");
      return {
        testName: `${decodeXmlText(className ?? "")} ${decodeXmlText(testName ?? "")}`,
        output: output.slice(-maximumOutputCharacters),
      };
    });
}

/** A workflow command's data with `%`, CR and LF escaped as GitHub reads them. */
export function escapeWorkflowData(commandData: string): string {
  return commandData
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

if (import.meta.main) {
  const junitPath = process.argv[2] ?? "target/nextest/default/junit.xml";
  if (!existsSync(junitPath)) {
    console.log(`No JUnit report at ${junitPath}`);
    process.exit(0);
  }
  for (const failedTest of readFailedTests(readFileSync(junitPath, "utf8"))) {
    console.log(
      `::error title=${escapeWorkflowData(failedTest.testName)}::${escapeWorkflowData(failedTest.output)}`,
    );
  }
}
