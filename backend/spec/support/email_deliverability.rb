# The sign-in flow checks the recipient domain's MX records (LoginCodeRequest).
# Specs never reach DNS: every domain accepts mail unless a spec says otherwise.
RSpec.configure do |config|
  config.before do
    allow_any_instance_of(ValidEmail2::Address).to(receive(:valid_mx?).and_return(true))
  end
end
