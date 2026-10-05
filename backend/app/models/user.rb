# == Schema Information
#
# Table name: users
#
#  id                       :bigint           not null, primary key
#  admin                    :boolean          default(FALSE), not null
#  deactivated_at           :datetime
#  deletion_requested_at    :datetime
#  email                    :string           not null
#  failed_password_attempts :integer          default(0), not null
#  login_attempts           :integer          default(0), not null
#  login_token              :string
#  login_token_sent_at      :datetime
#  password_changed_at      :datetime
#  password_digest          :string
#  password_locked_until    :datetime
#  pending_password_digest  :string
#  sessions_revoked_at      :datetime
#  shortlinks_count         :integer          default(0), not null
#  verified_at              :datetime
#  created_at               :datetime         not null
#  updated_at               :datetime         not null
#
# Indexes
#
#  index_users_on_deletion_requested_at       (deletion_requested_at) WHERE (deletion_requested_at IS NOT NULL)
#  index_users_on_login_token                 (login_token) UNIQUE
#  index_users_on_lower_email                 (lower((email)::text)) UNIQUE
#  index_users_on_verified_at_and_created_at  (verified_at,created_at)
#
class User < ApplicationRecord
  include PgSearch::Model
  include PasswordAuthenticatable

  MAX_LOGIN_ATTEMPTS = 5
  LOGIN_TOKEN_TTL = 15.minutes
  MAGIC_LINK_COOLDOWN = 1.minute
  DELETION_GRACE = 30.days
  RESTORE_WINDOW = 10.minutes

  # ===============
  # Audit
  # ===============
  audited only: [:email, :admin, :deactivated_at, :deletion_requested_at, :password_changed_at]

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
  validates :time_zone, inclusion: { in: ->(_) { TZInfo::Timezone.all_identifiers } }

  # ===============
  # Associations
  # ===============
  has_many :shortlinks, dependent: :destroy
  has_many :pages, dependent: :destroy
  has_many :forms, dependent: :destroy
  has_many :page_templates, dependent: :destroy
  has_many :color_palettes, dependent: :destroy
  has_many :push_subscriptions, dependent: :delete_all
  has_many :page_template_reports, dependent: :delete_all
  has_many :identities, dependent: :delete_all
  has_many :oauth_grants, dependent: :destroy

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

  def pending_deletion?
    deletion_requested_at.present?
  end

  def can_sign_in?
    deactivated_at.nil? || pending_deletion?
  end

  def deactivate!
    update!(deactivated_at: Time.current, deletion_requested_at: nil)
    shortlinks.active.find_each do |shortlink|
      shortlink.remove_cache
      shortlink.update!(inactive_at: Time.current)
    end
  end

  def reactivate!
    update!(deactivated_at: nil)
  end

  def request_deletion!
    deactivate!
    update!(deletion_requested_at: deactivated_at, sessions_revoked_at: Time.current)
    oauth_grants.find_each(&:revoke!)
  end

  def cancel_deletion!
    paused_since = deactivated_at
    update!(deactivated_at: nil, deletion_requested_at: nil)
    shortlinks.where(inactive_at: paused_since..(paused_since + RESTORE_WINDOW)).update_all(inactive_at: nil)
  end

  def deletion_due_at
    deletion_requested_at && deletion_requested_at + DELETION_GRACE
  end

  def purge!
    transaction do
      page_ids = Page.with_deleted.where(user_id: id).pluck(:id)
      owned = {
        "Shortlink" => Shortlink.with_deleted.where(user_id: id).pluck(:id),
        "Page" => page_ids,
        "PageLink" => PageLink.where(page_id: page_ids).pluck(:id),
        "Form" => forms.pluck(:id),
        "OauthGrant" => oauth_grants.pluck(:id),
        "User" => [id],
      }

      Shortlink.with_deleted.where(user_id: id).find_each(&:destroy!)
      Page.with_deleted.where(user_id: id).find_each(&:destroy!)
      destroy!

      owned.each { |type, ids| Audited::Audit.where(auditable_type: type, auditable_id: ids).delete_all }
      Audited::Audit.where(associated_type: "Page", associated_id: page_ids).delete_all
      Audited::Audit.where(user_type: "User", user_id: id).delete_all
    end
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

  def send_magic_link(purpose: :sign_in)
    return if magic_link_recently_sent?

    generate_login_token!
    LoginMailer.with(user: self, purpose: purpose.to_s).magic_link.deliver_later
  end

  def verified?
    verified_at.present?
  end

  # The first successful sign-in proves the address is real and reachable.
  def mark_verified!
    update!(verified_at: Time.current) unless verified?
  end
end
