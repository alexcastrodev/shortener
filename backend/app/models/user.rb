class User < ApplicationRecord
  validates :email, presence: true, uniqueness: true

  def generate_login_token!
    update!(
      login_token: SecureRandom.random_number(10**7).to_s.rjust(7, '0'),
      login_token_sent_at: Time.current
    )
  end

  def login_token_valid?
    login_token_sent_at && login_token_sent_at > 15.minutes.ago
  end

  def clear_login_token!
    update!(login_token: nil, login_token_sent_at: nil)
  end

  def send_magic_link
    generate_login_token!
    LoginMailer.with(user: self).magic_link.deliver_later
  end
end
