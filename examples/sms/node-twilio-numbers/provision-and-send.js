// The official Twilio Node SDK against SendMock's number APIs: buy a number, put it in a new
// Messaging Service and send through the service, so SendMock picks the number (SM-20.5).
import twilio from "twilio";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const poolNumber = "+15557770123";

/** Sends every Twilio request to SendMock's provider port, keeping its path and query. */
class SendMockRequestClient extends twilio.RequestClient {
  request(requestOptions) {
    const twilioUrl = new URL(requestOptions.uri);
    const sendmockRequestUrl = new URL(
      `${twilioUrl.pathname}${twilioUrl.search}`,
      providerUrl,
    );

    return super.request({ ...requestOptions, uri: sendmockRequestUrl.href });
  }
}

const client = twilio("ACtest00000000000000000000000000", "twilio-test-token", {
  httpClient: new SendMockRequestClient(),
});

const incomingNumber = await client.incomingPhoneNumbers.create({
  phoneNumber: poolNumber,
  friendlyName: "Clinic line",
});
const messagingService = await client.messaging.v1.services.create({
  friendlyName: "Clinic reminders",
});
const serviceNumber = await client.messaging.v1
  .services(messagingService.sid)
  .phoneNumbers.create({ phoneNumberSid: incomingNumber.sid });
if (serviceNumber.sid !== incomingNumber.sid) {
  throw new Error(`The service holds ${serviceNumber.sid}`);
}
const listedNumbers = await client.incomingPhoneNumbers.list({
  phoneNumber: poolNumber,
});
if (listedNumbers.length !== 1) {
  throw new Error(`Listed ${listedNumbers.length} numbers for ${poolNumber}`);
}

const message = await client.messages.create({
  messagingServiceSid: messagingService.sid,
  to: "+14155550120",
  body: "Your appointment is tomorrow at 10:00",
});
if (message.from !== poolNumber) {
  throw new Error(`Sent from ${message.from}, not the pool's ${poolNumber}`);
}
console.log(
  `Number ${incomingNumber.sid} in ${messagingService.sid} sent ${message.sid} from ${message.from}`,
);
