# == Schema Information
#
# Table name: identities
#
#  id           :bigint           not null, primary key
#  email        :string
#  last_used_at :datetime
#  provider     :string           not null
#  uid          :string           not null
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#  user_id      :bigint           not null
#
# Indexes
#
#  index_identities_on_provider_and_uid      (provider,uid) UNIQUE
#  index_identities_on_user_id               (user_id)
#  index_identities_on_user_id_and_provider  (user_id,provider) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id) ON DELETE => cascade
#
class Identity < ApplicationRecord
  PROVIDERS = ["google"].freeze

  belongs_to :user

  validates :provider, inclusion: { in: PROVIDERS }
  validates :uid, presence: true, uniqueness: { scope: :provider }
end
