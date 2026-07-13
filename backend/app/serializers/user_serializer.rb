# == Schema Information
#
# Table name: users
#
#  id                  :bigint           not null, primary key
#  admin               :boolean          default(FALSE), not null
#  email               :string           not null
#  login_token         :string
#  login_token_sent_at :datetime
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_users_on_login_token  (login_token) UNIQUE
#  index_users_on_lower_email  (lower((email)::text)) UNIQUE
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
