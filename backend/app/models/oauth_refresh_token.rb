class OauthRefreshToken < ApplicationRecord
  SLIDING_TTL = 30.days
  ABSOLUTE_TTL = 90.days

  belongs_to :oauth_grant

  before_create { self.created_at ||= Time.current }

  def self.issue(grant, absolute_expires_at: ABSOLUTE_TTL.from_now)
    raw = Oauth::Tokens.generate(:refresh)
    create!(
      oauth_grant: grant,
      token_digest: Oauth::Tokens.digest(raw),
      expires_at: [SLIDING_TTL.from_now, absolute_expires_at].min,
      absolute_expires_at: absolute_expires_at,
    )
    raw
  end

  def self.rotate(raw)
    return unless Oauth::Tokens.kind?(raw, :refresh)

    digest = Oauth::Tokens.digest(raw)
    claimed = where(token_digest: digest, used_at: nil).where("expires_at > ?", Time.current).update_all(used_at: Time.current)
    current = find_by(token_digest: digest)
    return unless current

    if claimed == 1
      current
    else
      current.oauth_grant.revoke! if current.used_at
      nil
    end
  end
end
