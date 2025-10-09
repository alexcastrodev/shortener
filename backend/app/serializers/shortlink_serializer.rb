# frozen_string_literal: true

# == Schema Information
#
# Table name: shortlinks
#
#  id               :bigint           not null, primary key
#  events_count     :integer          default(0), not null
#  last_accessed_at :datetime
#  original_url     :string           not null
#  short_code       :string           not null
#  title            :string
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  user_id          :bigint           not null
#
# Indexes
#
#  index_shortlinks_on_short_code  (short_code) UNIQUE
#  index_shortlinks_on_user_id     (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#
class ShortlinkSerializer < BaseSerializer
  with_id
  root_key_for_collection :shortlink

  #------------
  # Attributes
  #------------
  attributes :original_url, :title, :events_count, :last_accessed_at, :short_code, :short_url
end
