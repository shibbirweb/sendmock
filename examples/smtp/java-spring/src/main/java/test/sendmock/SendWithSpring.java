package test.sendmock;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** Spring's mail sender with the host and port a Spring app sets in application.properties. */
public final class SendWithSpring {
    private SendWithSpring() {}

    private static String readSetting(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null || value.isEmpty() ? defaultValue : value;
    }

    public static void main(String[] arguments) {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(readSetting("SMTP_HOST", "127.0.0.1"));
        mailSender.setPort(Integer.parseInt(readSetting("SMTP_PORT", "1025")));

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("app@spring.test");
        message.setTo("user@example.test");
        message.setSubject(readSetting("SUBJECT", "From Spring"));
        message.setText("Your code is 482913");
        mailSender.send(message);
    }
}
