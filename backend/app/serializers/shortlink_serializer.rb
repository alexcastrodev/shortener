# frozen_string_literal: true

# == Schema Information
#
# Table name: shortlinks
#
#  id               :bigint           not null, primary key
#  deleted_at       :datetime
#  events_count     :integer          default(0), not null
#  expires_at       :datetime
#  inactive_at      :datetime
#  last_accessed_at :datetime
#  original_url     :string           not null
#  password_digest  :string
#  safe             :boolean          default(TRUE), not null
#  safe_checked_at  :datetime
#  short_code       :string           not null
#  title            :string
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  user_id          :bigint           not null
#
# Indexes
#
#  index_shortlinks_on_deleted_at  (deleted_at)
#  index_shortlinks_on_expires_at  (expires_at) WHERE ((expires_at IS NOT NULL) AND (inactive_at IS NULL))
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
  attributes :original_url, :title, :events_count, :last_accessed_at, :short_code, :short_url, :inactive_at, :safe

  attribute :is_active do |shortlink|
    shortlink.inactive_at.nil?
  end

  attribute :password_protected, &:password_protected?

  attribute :expires_at do |shortlink|
    shortlink.expires_at&.iso8601
  end

  attribute :created_at do |shortlink|
    shortlink.created_at&.iso8601
  end

  attributes :safe_checked_at, if: proc { |_s| params[:admin] }
end
