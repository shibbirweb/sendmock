using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

static string ReadSetting(string name, string defaultValue) =>
    Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : defaultValue;

var message = new MimeMessage();
message.From.Add(new MailboxAddress("App", "app@dotnet.test"));
message.To.Add(MailboxAddress.Parse("user@example.test"));
message.Subject = ReadSetting("SUBJECT", "From MailKit");
message.Body = new TextPart("plain") { Text = "Your code is 482913" };

using var client = new SmtpClient();
await client.ConnectAsync(ReadSetting("SMTP_HOST", "127.0.0.1"), int.Parse(ReadSetting("SMTP_PORT", "1025")), SecureSocketOptions.None);
await client.SendAsync(message);
await client.DisconnectAsync(true);
