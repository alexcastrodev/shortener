# SMTP for outgoing mail, shared by the development and production configs.
# Resend when MAIL_PROVIDER=resend and RESEND_API_KEY is set (sends as
# MAIL_FROM on kurz.fyi, signed with the domain's DKIM); otherwise the Gmail
# account, as before. The explicit switch matters: Resend refuses to send for
# a domain whose DNS records are not verified yet, so having the key around
# must not be enough to move every sign-in email over.
module MailSettings
  extend self

  def resend?
    ENV["MAIL_PROVIDER"] == "resend" && ENV["RESEND_API_KEY"].present?
  end

  def smtp
    if resend?
      {
        address: "smtp.resend.com",
        port: 587,
        user_name: "resend",
        password: ENV["RESEND_API_KEY"],
        authentication: "plain",
        enable_starttls_auto: true,
        open_timeout: 10,
        read_timeout: 15,
      }
    else
      {
        address: "smtp.gmail.com",
        port: 587,
        domain: "gmail.com",
        user_name: ENV["GMAIL_USERNAME"],
        password: ENV["GMAIL_APP_PASSWORD"],
        authentication: "plain",
        enable_starttls_auto: true,
        open_timeout: 10,
        read_timeout: 15,
      }
    end
  end

  # Gmail rewrites any other sender to the account's own address, so the
  # sender must match the provider.
  def from
    if resend?
      ENV.fetch("MAIL_FROM", "Kurz <login@kurz.fyi>")
    else
      "Kurz <#{ENV.fetch("GMAIL_USERNAME", "kurz.fyi@gmail.com")}>"
    end
  end
end
