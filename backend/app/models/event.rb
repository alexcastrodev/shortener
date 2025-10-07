# == Schema Information
#
# Table name: events
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
#  shortlink_id :bigint           not null
#
# Indexes
#
#  index_events_on_shortlink_id  (shortlink_id)
#
# Foreign Keys
#
#  fk_rails_...  (shortlink_id => shortlinks.id)
#
class Event < ApplicationRecord
  # ===============
  # Associations
  # ===============
  belongs_to :shortlink

  # ===============
  # Validations
  # ===============
  validates :clicked_at, presence: true
  validates :shortlink, presence: true
  validates :ip_address, :user_agent, :referer, :country_code, :region, :platform, :browser, length: { maximum: 255 }, allow_nil: true

  # ===============
  # Callbacks
  # ===============
  before_validation :set_clicked_at, on: :create

  private

  def set_clicked_at
      self.clicked_at ||= Time.current
  end
end
