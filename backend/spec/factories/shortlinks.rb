# == Schema Information
#
# Table name: shortlinks
#
#  id               :bigint           not null, primary key
#  created_by_guest :boolean          default(FALSE)
#  events_count     :integer          default(0), not null
#  last_accessed_at :datetime
#  original_url     :string           not null
#  safe             :boolean          default(TRUE), not null
#  safe_checked_at  :datetime
#  short_code       :string           not null
#  title            :string
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  user_id          :bigint
#
# Indexes
#
#  index_shortlinks_on_short_code  (short_code) UNIQUE
#  index_shortlinks_on_user_id     (user_id)
#
FactoryBot.define do
  factory :shortlink do
    original_url { "https://example.com" }
    title { "Example Shortlink" }
    last_accessed_at { nil }

    trait :with_user do
      user { association :user }
    end
  end
end
