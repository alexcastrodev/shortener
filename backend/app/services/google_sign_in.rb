# "Sign in with Google". The frontend draws its own button and opens Google's
# popup (authorization code flow, redirect_uri "postmessage"); the one-time
# code comes here and is exchanged, with the client secret, for Google's ID
# token. An ID token handed over directly (Google's own rendered button, One
# Tap) is accepted too.
#
# Either way the ID token is trusted only after checking Google's signature,
# the issuer, that it was issued for our client id and has not expired, and
# that Google verified the email.
#
# The Google account is linked by its stable id. The first time, it attaches
# to the Kurz account with the same email, or creates one: Google has proven
# the address, so the account starts verified and no email is sent.
class GoogleSignIn
  include Callable

  PROVIDER = "google"
  TOKEN_URL = URI("https://oauth2.googleapis.com/token")
  # The popup flow of Google Identity Services has no real redirect.
  POPUP_REDIRECT_URI = "postmessage"

  Result = Data.define(:user, :error)

  def self.enabled?
    ENV["GOOGLE_CLIENT_ID"].present?
  end

  def initialize(credential: nil, code: nil)
    @credential = credential.to_s
    @code = code.to_s
  end

  def call
    return failure(:disabled) unless self.class.enabled?

    id_token = code.present? ? exchange_code : credential
    return failure(:invalid_token) if id_token.blank?

    payload = Google::Auth::IDTokens.verify_oidc(id_token, aud: ENV["GOOGLE_CLIENT_ID"])
    return failure(:email_not_verified) unless payload["email_verified"] == true

    user = link(payload["sub"].to_s, payload["email"].to_s.strip.downcase)
    user.deactivated? ? failure(:deactivated) : Result.new(user: user, error: nil)
  rescue Google::Auth::IDTokens::VerificationError, Google::Auth::IDTokens::KeySourceError => e
    Rails.logger.info("[GoogleSignIn] rejected token: #{e.class}")
    failure(:invalid_token)
  end

  private

  attr_reader :credential, :code

  def failure(error)
    Result.new(user: nil, error: error)
  end

  # nil when Google refuses the code (expired, reused, wrong client).
  def exchange_code
    secret = ENV["GOOGLE_CLIENT_SECRET"]
    return if secret.blank?

    http = Net::HTTP.new(TOKEN_URL.host, TOKEN_URL.port)
    http.use_ssl = true
    http.open_timeout = 5
    http.read_timeout = 8
    request = Net::HTTP::Post.new(TOKEN_URL)
    request.set_form_data(
      code: code.first(1024),
      client_id: ENV["GOOGLE_CLIENT_ID"],
      client_secret: secret,
      redirect_uri: POPUP_REDIRECT_URI,
      grant_type: "authorization_code",
    )
    response = http.request(request)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.info("[GoogleSignIn] code exchange refused: #{response.code}")
      return
    end

    JSON.parse(response.body)["id_token"]
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED, JSON::ParserError => e
    Rails.logger.warn("[GoogleSignIn] code exchange failed: #{e.class}")
    nil
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
