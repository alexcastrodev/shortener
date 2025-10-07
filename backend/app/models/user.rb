class User < ApplicationRecord
  validates :email, presence: true, uniqueness: true

  def generate_login_token!
    update!(
      login_token: SecureRandom.urlsafe_base64(32),
      login_token_sent_at: Time.current
    )
  end

  def login_token_valid?
    login_token_sent_at && login_token_sent_at > 15.minutes.ago
  end

  def clear_login_token!
    update!(login_token: nil, login_token_sent_at: nil)
  end
end
