# == Schema Information
#
# Table name: users
#
#  id                  :bigint           not null, primary key
#  email               :string           not null
#  login_token         :string
#  login_token_sent_at :datetime
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_users_on_email        (email) UNIQUE
#  index_users_on_login_token  (login_token) UNIQUE
#
class User < ApplicationRecord
  # ===============
  # Validations
  # ===============
  validates :email, presence: true, uniqueness: true

  # ===============
  # Associations
  # ===============
  has_many :shortlinks, dependent: :destroy

  def generate_login_token!
    update!(
      login_token: SecureRandom.random_number(10**7).to_s.rjust(7, "0"),
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
