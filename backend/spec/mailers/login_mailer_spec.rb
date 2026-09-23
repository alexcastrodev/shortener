require "rails_helper"

RSpec.describe(LoginMailer) do
  let(:user) { User.create!(email: "reader@example.com").tap(&:generate_login_token!) }
  let(:mail) { described_class.with(user: user).magic_link }

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    example.run
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  it "comes from the sending account, with a display name" do
    expect(mail[:from].to_s).to(eq("Kurz <kurz.fyi@gmail.com>"))
  end

  it "puts the code in the subject" do
    expect(mail.subject).to(eq("#{user.login_token} is your Kurz sign-in code"))
  end

  it "sends a plain-text part next to the HTML" do
    expect(mail.mime_type).to(eq("multipart/alternative"))
    expect(mail.text_part.body.decoded).to(include(user.login_token, "expires in 15 minutes"))
    expect(mail.html_part.body.decoded).to(include(user.login_token))
  end

  it "renders a single HTML document" do
    html = mail.html_part.body.decoded

    expect(html.scan(/<html/i).size).to(eq(1))
    expect(html).not_to(include("Shortener"))
  end

  it "tells the owner of an existing account what confirming a sign-up does" do
    mail = described_class.with(user: user, purpose: "sign_up_existing").magic_link

    expect(mail.subject).to(eq("#{user.login_token} is your Kurz confirmation code"))
    expect(mail.text_part.body.decoded).to(include("already has a Kurz account", "someone tried to create a Kurz account"))
  end
end
