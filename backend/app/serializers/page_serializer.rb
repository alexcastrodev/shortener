# frozen_string_literal: true

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
class PageSerializer < BaseSerializer
  with_id
  with_timestamps
  root_key_for_collection :page

  #------------
  # Attributes
  #------------
  attributes :slug, :display_title, :bio, :theme, :published

  attribute :expires_at do |page|
    page.expires_at&.iso8601
  end

  attributes :public_url, :avatar_url

  # A new avatar is being optimized in the background; avatar_url still
  # points at the previous one until it is done.
  attribute :avatar_processing do |page|
    page.avatar_processing?
  end

  many :page_links, key: :links, resource: PageLinkSerializer, if: proc { |_| params[:with_links] }
end
