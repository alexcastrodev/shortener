# == Schema Information
#
# Table name: pages
#
#  id            :bigint           not null, primary key
#  bio           :text
#  deleted_at    :datetime
#  display_title :string
#  expires_at    :datetime
#  published     :boolean          default(TRUE), not null
#  slug          :string           not null
#  theme         :string           default("default"), not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  user_id       :bigint           not null
#
# Indexes
#
#  index_pages_on_deleted_at  (deleted_at)
#  index_pages_on_slug        (slug) UNIQUE
#  index_pages_on_user_id     (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#
FactoryBot.define do
  factory :page do
    sequence(:slug) { |n| "page#{n}#{SecureRandom.hex(2)}" }
    display_title { "My links" }
    bio { "Hello there" }
    user { association :user }
  end

  factory :page_link do
    label { "Website" }
    url { "https://example.com" }
    page { association :page }
  end
end
