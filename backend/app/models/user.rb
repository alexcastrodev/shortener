# == Schema Information
#
# Table name: users
#
#  id                  :bigint           not null, primary key
#  admin               :boolean          default(FALSE), not null
#  deactivated_at      :datetime
#  email               :string           not null
#  login_attempts      :integer          default(0), not null
#  login_token         :string
#  login_token_sent_at :datetime
#  shortlinks_count    :integer          default(0), not null
#  verified_at         :datetime
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_users_on_login_token                 (login_token) UNIQUE
#  index_users_on_lower_email                 (lower((email)::text)) UNIQUE
#  index_users_on_verified_at_and_created_at  (verified_at,created_at)
#
class User < ApplicationRecord
  include PgSearch::Model

  MAX_LOGIN_ATTEMPTS = 5
  LOGIN_TOKEN_TTL = 15.minutes
  MAGIC_LINK_COOLDOWN = 1.minute

  # ===============
  # Audit
  # ===============
  audited only: [:email, :admin, :deactivated_at]

  # ===============
  # Search
  # ===============
  pg_search_scope :search_by_term,
    against: :email,
    using: { tsearch: { prefix: true } }

  # ===============
  # Validations
  # ===============
  normalizes :email, with: ->(email) { email.strip.downcase }
  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }

  # ===============
  # Associations
  # ===============
  has_many :shortlinks, dependent: :destroy
  has_many :pages, dependent: :destroy
  has_many :page_templates, dependent: :destroy
  has_many :page_template_reports, dependent: :delete_all

  # ===============
  # Scopes
  # ===============
  scope :active, -> { where(deactivated_at: nil) }

  def active?
    deactivated_at.nil?
  end

  def deactivated?
    deactivated_at.present?
  end

  def deactivate!
    update!(deactivated_at: Time.current)
    shortlinks.active.find_each do |shortlink|
      shortlink.remove_cache
      shortlink.update!(inactive_at: Time.current)
    end
  end

  def reactivate!
    update!(deactivated_at: nil)
  end

  def generate_login_token!
    update!(
      login_token: SecureRandom.random_number(10**7).to_s.rjust(7, "0"),
      login_token_sent_at: Time.current,
      login_attempts: 0,
    )
  end

  def login_token_valid?
    login_token_sent_at && login_token_sent_at > LOGIN_TOKEN_TTL.ago
  end

  # Checks the code in constant time. Each wrong guess counts as an attempt;
  # after MAX_LOGIN_ATTEMPTS the token is burned and a new link is required.
  def verify_login_token(code)
    return false unless login_token.present? && login_token_valid?
    return true if ActiveSupport::SecurityUtils.secure_compare(login_token, code.to_s)

    increment!(:login_attempts)
    clear_login_token! if login_attempts >= MAX_LOGIN_ATTEMPTS
    false
  end

  def clear_login_token!
    update!(login_token: nil, login_token_sent_at: nil, login_attempts: 0)
  end

  def magic_link_recently_sent?
    login_token_sent_at.present? && login_token_sent_at > MAGIC_LINK_COOLDOWN.ago
  end

  def send_magic_link
    return if magic_link_recently_sent?

    generate_login_token!
    LoginMailer.with(user: self).magic_link.deliver_later
  end

  def verified?
    verified_at.present?
  end

  # The first successful sign-in proves the address is real and reachable.
  def mark_verified!
    update!(verified_at: Time.current) unless verified?
  end
end
