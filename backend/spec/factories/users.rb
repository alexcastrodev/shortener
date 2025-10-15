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
#  index_users_on_email        (email) UNIQUE
#  index_users_on_login_token  (login_token) UNIQUE
#
FactoryBot.define do
  factory :user do
    email { Faker::Internet.unique.email }
  end
end
