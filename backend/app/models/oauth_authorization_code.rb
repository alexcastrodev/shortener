class OauthAuthorizationCode < ApplicationRecord
  TTL = 60.seconds

  belongs_to :oauth_grant

  before_create { self.created_at ||= Time.current }

  def self.issue(grant:, code_challenge:, redirect_uri:)
    raw = Oauth::Tokens.generate(:code)
    create!(oauth_grant: grant, code_digest: Oauth::Tokens.digest(raw), code_challenge: code_challenge, redirect_uri: redirect_uri, expires_at: TTL.from_now)
    raw
  end

  def self.redeem(raw)
    return unless Oauth::Tokens.kind?(raw, :code)

    digest = Oauth::Tokens.digest(raw)
    claimed = where(code_digest: digest, used_at: nil).where("expires_at > ?", Time.current).update_all(used_at: Time.current)
    return find_by!(code_digest: digest) if claimed == 1

    replayed = find_by(code_digest: digest)
    replayed&.oauth_grant&.revoke!
    nil
  end
end
