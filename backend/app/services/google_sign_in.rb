# "Sign in with Google" (Google Identity Services). The browser gets an ID
# token from Google and hands it over; it is trusted only after checking
# Google's signature, the issuer, that it was issued for our client id
# (GOOGLE_CLIENT_ID) and has not expired, and that Google verified the email.
#
# The Google account is linked by its stable id. The first time, it attaches
# to the Kurz account with the same email, or creates one: Google has proven
# the address, so the account starts verified and no email is sent.
class GoogleSignIn
  include Callable

  PROVIDER = "google"

  Result = Data.define(:user, :error)

  def self.enabled?
    ENV["GOOGLE_CLIENT_ID"].present?
  end

  def initialize(credential:)
    @credential = credential.to_s
  end

  def call
    return failure(:disabled) unless self.class.enabled?
    return failure(:invalid_token) if credential.blank?

    payload = Google::Auth::IDTokens.verify_oidc(credential, aud: ENV["GOOGLE_CLIENT_ID"])
    return failure(:email_not_verified) unless payload["email_verified"] == true

    user = link(payload["sub"].to_s, payload["email"].to_s.strip.downcase)
    user.deactivated? ? failure(:deactivated) : Result.new(user: user, error: nil)
  rescue Google::Auth::IDTokens::VerificationError, Google::Auth::IDTokens::KeySourceError => e
    Rails.logger.info("[GoogleSignIn] rejected token: #{e.class}")
    failure(:invalid_token)
  end

  private

  attr_reader :credential

  def failure(error)
    Result.new(user: nil, error: error)
  end

  def link(uid, email)
    identity = Identity.find_by(provider: PROVIDER, uid: uid)
    if identity
      identity.update!(email: email, last_used_at: Time.current)
      return identity.user
    end

    User.transaction do
      user = User.find_by(email: email) || User.create!(email: email)
      # An unconfirmed account may carry a password someone else chose at
      # sign-up; Google just proved who owns the address, so drop it.
      user.discard_pending_password!
      user.mark_verified!
      user.identities.create!(provider: PROVIDER, uid: uid, email: email, last_used_at: Time.current)
      user
    end
  end
end
