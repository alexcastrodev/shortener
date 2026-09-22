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
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_users_on_login_token  (login_token) UNIQUE
#  index_users_on_lower_email  (lower((email)::text)) UNIQUE
#
FactoryBot.define do
  factory :user do
    email { Faker::Internet.unique.email }
  end
end
