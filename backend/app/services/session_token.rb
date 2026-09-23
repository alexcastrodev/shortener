# Session tokens: HS256 JWTs signed with a key dedicated to this purpose
# (derived from secret_key_base, never secret_key_base itself), carrying a
# jti so a single token can be revoked before it expires (logout).
module SessionToken
  extend self

  TTL = 2.days
  ALGORITHM = "HS256"

  class Revoked < JWT::DecodeError; end

  def issue(user)
    now = Time.current
    JWT.encode({ sub: user.id, jti: SecureRandom.uuid, iat: now.to_i, exp: (now + TTL).to_i }, key, ALGORITHM)
  end

  # The algorithm is pinned: the header's "alg" is never trusted ("none",
  # algorithm confusion). Raises JWT::DecodeError (or a subclass) when the
  # token is invalid, expired or revoked.
  def decode(token)
    payload, _header = JWT.decode(token, key, true, algorithm: ALGORITHM, required_claims: ["sub", "jti", "exp"])
    raise Revoked, "Token has been revoked" if revoked?(payload["jti"])

    payload
  end

  # Kept until the token would have expired anyway. Needs the shared Redis
  # cache (as in production); with a null store revocation is a no-op.
  def revoke(payload)
    ttl = payload["exp"].to_i - Time.current.to_i
    Rails.cache.write(revocation_key(payload["jti"]), true, expires_in: ttl) if ttl.positive?
  end

  def revoked?(jti)
    Rails.cache.exist?(revocation_key(jti))
  end

  private

  def revocation_key(jti)
    "session_token:revoked:#{jti}"
  end

  def key
    @key ||= Rails.application.key_generator.generate_key("kurz session token v1", 64)
  end
end
