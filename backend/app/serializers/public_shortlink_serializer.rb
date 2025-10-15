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
#  user_id          :bigint
#
# Indexes
#
#  index_shortlinks_on_short_code  (short_code) UNIQUE
#  index_shortlinks_on_user_id     (user_id)
#
class PublicShortlinkSerializer < BaseSerializer
  root_key_for_collection :public_shortlink

  #------------
  # Attributes
  #------------
  attributes :original_url, :short_url
end
