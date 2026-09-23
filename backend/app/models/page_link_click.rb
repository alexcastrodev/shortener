# == Schema Information
#
# Table name: page_link_clicks
#
#  id           :bigint           not null, primary key
#  browser      :string
#  clicked_at   :datetime         not null
#  country_code :string
#  ip_address   :string
#  platform     :string
#  referer      :string
#  region       :string
#  user_agent   :string
#  page_link_id :bigint           not null
#
# Indexes
#
#  index_page_link_clicks_on_page_link_id                 (page_link_id)
#  index_page_link_clicks_on_page_link_id_and_clicked_at  (page_link_id,clicked_at)
#
# Foreign Keys
#
#  fk_rails_...  (page_link_id => page_links.id) ON DELETE => cascade
#
class PageLinkClick < ApplicationRecord
  # ===============
  # Associations
  # ===============
  belongs_to :page_link
  counter_culture :page_link, column_name: "clicks_count"

  # ===============
  # Validations
  # ===============
  validates :clicked_at, presence: true
  validates :ip_address, :user_agent, :referer, :country_code, :region, :platform, :browser, length: { maximum: 255 }, allow_nil: true

  # ===============
  # Callbacks
  # ===============
  before_validation :set_clicked_at, on: :create
  after_commit :ipaddr_job, on: :create, if: :missing_location?

  private

  def set_clicked_at
    self.clicked_at ||= Time.current
  end

  def missing_location?
    ip_address.present? && (country_code.blank? || region.blank?)
  end

  def ipaddr_job
    IpaddrJob.perform_later(id, model: self.class.name)
  end
end
