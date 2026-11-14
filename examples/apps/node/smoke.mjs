// An app's test on Node's own fetch: it sends an email and reads its code, sends an SMS and
// waits for it, and captures an outgoing HTTP call, all against a running SendMock.
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";

async function call(method, path, body) {
  const response = await fetch(`${sendmockUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function expectEqual(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${expected}, got ${actual}`);
  }
}

await call("POST", "/api/v1/send", {
  from: "app@shop.test",
  to: ["node@example.test"],
  subject: "Your code",
  text: "Your code is 482913",
});
const otp = await call("GET", "/api/v1/otp?to=node%40example.test&timeout=10s");
expectEqual(otp.code, "482913", "The code in the email");

await call("POST", "/api/v1/sms", { from: "+15550001111", to: "+15550002222", body: "Hello from Node" });
const sms = await call("GET", "/api/v1/wait/sms?to=%2B15550002222&timeout=10s");
expectEqual(sms.body, "Hello from Node", "The SMS body");

await fetch(`${sendmockUrl}/catch/node-orders/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ order: 42 }),
});
const captured = await call("GET", "/api/v1/wait/http?bin=node-orders&timeout=10s");
expectEqual(captured.method, "POST", "The captured request's method");
expectEqual(captured.body.includes('"order":42'), true, "The captured body");

console.log("Node: email, SMS and HTTP capture all work.");
