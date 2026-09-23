require "rails_helper"

RSpec.describe(MailSettings) do
  around do |example|
    keys = ["MAIL_PROVIDER", "RESEND_API_KEY", "MAIL_FROM", "GMAIL_USERNAME"]
    previous = ENV.to_h.slice(*keys)
    keys.each { |key| ENV.delete(key) }
    example.run
  ensure
    keys.each { |key| ENV.delete(key) }
    ENV.update(previous)
  end

  it "keeps using Gmail while only the Resend key is present" do
    ENV["RESEND_API_KEY"] = "re_test"
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"

    expect(described_class.smtp[:address]).to(eq("smtp.gmail.com"))
    expect(described_class.from).to(eq("Kurz <kurz.fyi@gmail.com>"))
  end

  it "switches to Resend with MAIL_PROVIDER=resend" do
    ENV["MAIL_PROVIDER"] = "resend"
    ENV["RESEND_API_KEY"] = "re_test"

    expect(described_class.smtp).to(include(address: "smtp.resend.com", user_name: "resend", password: "re_test"))
    expect(described_class.from).to(eq("Kurz <login@kurz.fyi>"))
  end
end
