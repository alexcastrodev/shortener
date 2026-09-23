# The sign-in flow checks the recipient domain's MX records (LoginCodeRequest).
# Specs never reach DNS: every domain accepts mail unless a spec says otherwise.
RSpec.configure do |config|
  config.before do
    allow_any_instance_of(ValidEmail2::Address).to(receive(:valid_mx?).and_return(true))
  end
end

# PasswordPolicy asks Have I Been Pwned about every new password; by default no
# password is breached. Specs about breaches stub their own answer.
RSpec.configure do |config|
  config.before do
    stub_request(:get, %r{\Ahttps://api\.pwnedpasswords\.com/range/}).to_return(status: 200, body: "")
  end
end

# Specs never inherit the developer's or CI's mail/captcha settings; the ones
# about Turnstile or Resend set these themselves.
RSpec.configure do |config|
  config.before(:suite) do
    ["TURNSTILE_SECRET_KEY", "TURNSTILE_HOSTNAMES", "MAIL_PROVIDER", "RESEND_API_KEY", "MAIL_FROM", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].each { |key| ENV.delete(key) }
  end
end
