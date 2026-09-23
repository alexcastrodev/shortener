# frozen_string_literal: true

# == Schema Information
#
# Table name: page_links
#
#  id              :bigint           not null, primary key
#  active          :boolean          default(TRUE), not null
#  clicks_count    :integer          default(0), not null
#  icon            :string
#  kind            :string           default("link"), not null
#  label           :string           not null
#  position        :integer          default(0), not null
#  safe            :boolean          default(TRUE), not null
#  safe_checked_at :datetime
#  url             :string
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  page_id         :bigint           not null
#
# Indexes
#
#  index_page_links_on_page_id_and_position  (page_id,position)
#
# Foreign Keys
#
#  fk_rails_...  (page_id => pages.id) ON DELETE => cascade
#
class PageLinkSerializer < BaseSerializer
  with_id
  root_key_for_collection :page_link

  #------------
  # Attributes
  #------------
  attributes :kind, :label, :url, :icon, :position, :active, :clicks_count, :safe
end
