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
class UserSerializer < BaseSerializer
  with_id
  root_key_for_collection :user

  #------------
  # Attributes
  #------------
  attributes :email

  attribute :shortlinks_count do |record|
    record.shortlinks.count
  end
end
