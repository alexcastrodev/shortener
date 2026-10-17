# Passwords hashed with Argon2id (OWASP: at least 19 MiB, 2 iterations; we
# use 32 MiB). Hashes made with older parameters are upgraded on the next
# successful sign-in.
#
# Wrong passwords lock the password for a while, doubling each time; signing
# in with an emailed code keeps working, so a stranger guessing passwords
# cannot lock the owner out.
module PasswordAuthenticatable
  extend ActiveSupport::Concern

  ARGON2_COSTS = { t_cost: 2, m_cost: 15, p_cost: 1 }.freeze
  FREE_ATTEMPTS = 5
  MAX_LOCK = 1.hour

  # Compared against when the account does not exist, so a wrong email takes
  # as long as a wrong password and response times reveal nothing.
  DUMMY_DIGEST = Argon2::Password.create("kurz-dummy-password", **ARGON2_COSTS)

  class_methods do
    def hash_password(password)
      Argon2::Password.create(password, **ARGON2_COSTS)
    end

    # Spends the same work as a real check; always false.
    def burn_password_check(password)
      Argon2::Password.verify_password(password.to_s, DUMMY_DIGEST)
      false
    end
  end

  def password?
    password_digest.present?
  end

  def password_locked?
    password_locked_until.present? && password_locked_until.future?
  end

  # True only for the right password on an unlocked account.
  def authenticate_password(password)
    return self.class.burn_password_check(password) unless password? && !password_locked?

    if Argon2::Password.verify_password(password.to_s, password_digest)
      attributes = { failed_password_attempts: 0, password_locked_until: nil }
      attributes[:password_digest] = self.class.hash_password(password) if outdated_digest?
      update!(attributes)
      true
    else
      register_failed_password!
      false
    end
  end

  # Sets a new password and signs every other session out.
  def change_password!(password)
    now = Time.current
    update!(
      password_digest: self.class.hash_password(password),
      password_changed_at: now,
      failed_password_attempts: 0,
      password_locked_until: nil,
      sessions_revoked_at: now,
    )
  end

  # Tokens issued before the last password change (or "sign out everywhere")
  # are rejected.
  def session_current?(issued_at)
    sessions_revoked_at.nil? || issued_at.to_i >= sessions_revoked_at.to_i
  end

  private

  def register_failed_password!
    attempts = failed_password_attempts + 1
    lock = if attempts >= FREE_ATTEMPTS
      [1.minute * (2**(attempts - FREE_ATTEMPTS)), MAX_LOCK].min.from_now
    end
    update!(failed_password_attempts: attempts, password_locked_until: lock)
  end

  def outdated_digest?
    params = password_digest.to_s[/\$m=(\d+),t=(\d+),p=(\d+)\$/] && Regexp.last_match
    return true unless params

    [params[1].to_i, params[2].to_i, params[3].to_i] != [2**ARGON2_COSTS[:m_cost], ARGON2_COSTS[:t_cost], ARGON2_COSTS[:p_cost]]
  end
end
