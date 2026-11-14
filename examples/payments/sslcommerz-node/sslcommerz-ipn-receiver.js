// The app's SSLCommerz IPN route: it reads the posted form and checks `verify_sign` as
// SSLCommerz's integration guide does (the MD5 of the fields `verify_key` names plus the MD5
// of the store password, sorted by name and joined as `name=value&...`), keeping every IPN it
// accepted.
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";

function md5Hex(text) {
  return createHash("md5").update(text).digest("hex");
}

export function hasValidVerifySign(ipnFields, storePassword) {
  const signedNames = (ipnFields.verify_key ?? "").split(",").filter(Boolean);
  if (signedNames.length === 0 || !ipnFields.verify_sign) {
    return false;
  }
  const hashedFields = Object.fromEntries(
    signedNames.map((fieldName) => [fieldName, ipnFields[fieldName] ?? ""]),
  );
  hashedFields.store_passwd = md5Hex(storePassword);
  const hashText = Object.keys(hashedFields)
    .sort()
    .map((fieldName) => `${fieldName}=${hashedFields[fieldName]}`)
    .join("&");
  return md5Hex(hashText) === ipnFields.verify_sign;
}

export async function startIpnReceiver(storePassword) {
  const receivedIpns = [];
  const receiverServer = createServer((request, response) => {
    const bodyChunks = [];
    request.on("data", (bodyChunk) => bodyChunks.push(bodyChunk));
    request.on("end", () => {
      const ipnFields = Object.fromEntries(
        new URLSearchParams(Buffer.concat(bodyChunks).toString("utf8")),
      );
      if (!hasValidVerifySign(ipnFields, storePassword)) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("verify_sign does not match");
        return;
      }
      receivedIpns.push(ipnFields);
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("IPN received");
    });
  });
  receiverServer.listen(0, "127.0.0.1");
  await once(receiverServer, "listening");
  return {
    receiverServer,
    receivedIpns,
    receiverUrl: `http://127.0.0.1:${receiverServer.address().port}/sslcommerz/ipn`,
  };
}
