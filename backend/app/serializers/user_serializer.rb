# == Schema Information
#
# Table name: users
#
#  id                       :bigint           not null, primary key
#  admin                    :boolean          default(FALSE), not null
#  deactivated_at           :datetime
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
#  index_users_on_login_token                 (login_token) UNIQUE
#  index_users_on_lower_email                 (lower((email)::text)) UNIQUE
#  index_users_on_verified_at_and_created_at  (verified_at,created_at)
#
class UserSerializer < BaseSerializer
  with_id
  with_timestamps
  root_key_for_collection :user

  #------------
  # Attributes
  #------------
  attributes :email, :admin, :deactivated_at

  attributes :shortlinks_count
end
