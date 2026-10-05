class OauthAccessToken < ApplicationRecord
  TTL = 1.hour

  belongs_to :oauth_grant

  before_create { self.created_at ||= Time.current }

  def self.issue(grant)
    raw = Oauth::Tokens.generate(:access)
    create!(oauth_grant: grant, token_digest: Oauth::Tokens.digest(raw), expires_at: TTL.from_now)
    [raw, TTL.to_i]
  end

  def self.authenticate(raw)
    return unless Oauth::Tokens.kind?(raw, :access)

    includes(:oauth_grant).where("expires_at > ?", Time.current).find_by(token_digest: Oauth::Tokens.digest(raw))
  end
end
