# Decides whether a sign-in code request turns into an email. Every email
# costs provider quota and sender reputation, so requests that would bounce
# (no mail server, disposable address) or that nobody can use (deactivated
# account, code sent a moment ago) never reach the queue, and the rest must
# fit in MailBudget.
class LoginCodeRequest
  include Callable

  # :sent also covers requests that were quietly skipped, so the response
  # never tells whether an account exists or is deactivated.
  Result = Data.define(:status, :reason)

  def initialize(email:)
    @email = email.to_s.strip.downcase
  end

  def call
    return result(:invalid_email) unless ValidEmail2::Address.new(email).valid?

    user = User.find_by(email: email)
    return result(:sent) if user&.deactivated? || user&.magic_link_recently_sent?

    new_address = !user&.verified?
    return result(:undeliverable) if new_address && !deliverable?

    budget = MailBudget.reserve(new_address: new_address)
    return result(:budget_exhausted, budget.reason) unless budget.ok?

    user ||= User.create_or_find_by!(email: email)
    user.send_magic_link
    result(:sent)
  end

  private

  attr_reader :email

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
