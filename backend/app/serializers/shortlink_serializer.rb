# frozen_string_literal: true

# == Schema Information
#
# Table name: shortlinks
#
#  id               :bigint           not null, primary key
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
class ShortlinkSerializer < BaseSerializer
  with_id
  root_key_for_collection :shortlink
  maybe_one :user, resource: UserSerializer, if: proc { |_s| params[:admin] }

  #------------
  # Attributes
  #------------
  attributes :original_url, :title, :events_count, :last_accessed_at, :short_code, :short_url

  attribute :is_active do |shortlink|
    shortlink.safe?
  end

  attributes :safe, :safe_checked_at, if: proc { |_s| params[:admin] }
end
