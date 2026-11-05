import { describe, expect, test } from "bun:test";

import { escapeWorkflowData, readFailedTests } from "./nextest-failures";

const junitReport = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="nextest-run" tests="2" failures="1">
  <testsuite name="sendmock-api::email_spam_check_api" tests="2" failures="1">
    <testcase name="passes" classname="sendmock-api::email_spam_check_api" time="0.1"></testcase>
    <testcase name="fails" classname="sendmock-api::email_spam_check_api" time="0.2">
      <failure type="test failure">thread 'fails' panicked</failure>
      <system-err>assertion \`left == right\` failed
  left: 502
 right: 200 &amp; more</system-err>
    </testcase>
  </testsuite>
</testsuites>`;

describe("nextest failures", () => {
  test("lists only the failed tests with their output", () => {
    expect(readFailedTests(junitReport)).toEqual([
      {
        testName: "sendmock-api::email_spam_check_api fails",
        output:
          "thread 'fails' panicked\nassertion `left == right` failed\n  left: 502\n right: 200 & more",
      },
    ]);
  });

  test("escapes the characters a workflow command cannot hold", () => {
    expect(escapeWorkflowData("50%\nnext\r")).toBe("50%25%0Anext%0D");
  });
});
