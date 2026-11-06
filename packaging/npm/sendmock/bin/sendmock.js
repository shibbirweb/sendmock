#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");

const { locateBinary } = require("../lib/launcher.js");

const located = locateBinary(process.platform, process.arch, require.resolve);
if (located.errorMessage) {
  console.error(`sendmock: ${located.errorMessage}`);
  process.exit(1);
}

const child = spawn(located.binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});
// Ctrl+C and stop requests reach SendMock, which shuts down cleanly and exits on its own.
for (const signalName of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signalName, () => {
    child.kill(signalName);
  });
}
child.on("error", (spawnError) => {
  console.error(
    `sendmock: could not start ${located.binaryPath}: ${spawnError.message}`,
  );
  process.exit(1);
});
child.on("exit", (exitCode, exitSignal) => {
  if (exitSignal) {
    process.kill(process.pid, exitSignal);
    return;
  }
  process.exit(exitCode ?? 1);
});
