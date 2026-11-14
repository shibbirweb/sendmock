# Action Mailer, the mailer a Rails app sends with, configured as Rails would for SendMock.
require "action_mailer"

ActionMailer::Base.delivery_method = :smtp
ActionMailer::Base.smtp_settings = {
  address: ENV.fetch("SMTP_HOST", "127.0.0.1"),
  port: Integer(ENV.fetch("SMTP_PORT", "1025")),
  enable_starttls_auto: false,
}

class SignupMailer < ActionMailer::Base
  def code_email
    mail(
      from: "App <app@rails.test>",
      to: "user@example.test",
      subject: ENV.fetch("SUBJECT", "From Action Mailer"),
      body: "Your code is 482913",
    )
  end
end

SignupMailer.code_email.deliver_now
