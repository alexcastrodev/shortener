# Decides whether a request for an emailed code turns into an email. Every
# email costs provider quota and sender reputation, so requests that would
# bounce (no mail server, disposable address) or that nobody can use
# (deactivated account, code sent a moment ago) never reach the queue, and
# the rest must fit in MailBudget.
#
# Purposes: :sign_in (passwordless), :sign_up (also stages the chosen
# password until the code confirms it) and :password_reset (only for existing
# accounts; unknown addresses get the same answer and no email).
class LoginCodeRequest
  include Callable

  PURPOSES = [:sign_in, :sign_up, :password_reset].freeze
  STAGES_PASSWORD = [:sign_up, :sign_up_existing].freeze

  # :sent also covers requests that were quietly skipped, so the response
  # never tells whether an account exists or is deactivated.
  Result = Data.define(:status, :reason)

  def initialize(email:, purpose: :sign_in, password: nil)
    @email = email.to_s.strip.downcase
    @purpose = PURPOSES.include?(purpose) ? purpose : :sign_in
    @password = password
  end

  def call
    return result(:invalid_email) unless ValidEmail2::Address.new(email).valid?

    user = User.find_by(email: email)
    return result(:sent) if user&.deactivated?
    return result(:sent) if purpose == :password_reset && !user&.verified?

    # Signing up with an address that already has an account (made with
    # Google, or before passwords existed) gets the same answer. The chosen
    # password waits for the emailed code, which proves the address like a
    # password reset does; the email says the account already exists.
    mail_purpose = purpose == :sign_up && user&.verified? ? :sign_up_existing : purpose
    user&.stage_pending_password!(password) if STAGES_PASSWORD.include?(mail_purpose)
    return result(:sent) if user&.magic_link_recently_sent?

    new_address = !user&.verified?
    return result(:undeliverable) if new_address && !deliverable?

    budget = MailBudget.reserve(new_address: new_address)
    return result(:budget_exhausted, budget.reason) unless budget.ok?

    unless user
      user = User.create_or_find_by!(email: email)
      user.stage_pending_password!(password) if STAGES_PASSWORD.include?(mail_purpose)
    end
    user.send_magic_link(purpose: mail_purpose)
    result(:sent)
  end

  private

  attr_reader :email, :purpose, :password

  def result(status, reason = nil)
    Result.new(status: status, reason: reason)
  end

  # Verified accounts skip this: their address already received a code.
  def deliverable?
    address = ValidEmail2::Address.new(email)
    return false if address.disposable?

    Rails.cache.fetch("mail_mx:#{email.split("@").last}", expires_in: 1.day) { address.valid_mx? }
  end
end
