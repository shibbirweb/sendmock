// Nodemailer, as a Node app configures it for SendMock.
import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "127.0.0.1",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

await transport.sendMail({
  from: "App <app@node.test>",
  to: "user@example.test",
  subject: process.env.SUBJECT ?? "From Nodemailer",
  text: "Your code is 482913",
  html: "<p>Your code is <b>482913</b></p>",
});
