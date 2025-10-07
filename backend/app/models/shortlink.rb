# == Schema Information
#
# Table name: shortlinks
#
#  id               :bigint           not null, primary key
#  click_count      :integer          default(0), not null
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
class Shortlink < ApplicationRecord
    # ===============
    # Validations
    # ===============
    validates :original_url, presence: true
    validates :short_code, presence: true, uniqueness: true
    validates :click_count, numericality: { greater_than_or_equal_to: 0 }
    validates :user_id, presence: true
    
    # ===============
    # Associations
    # ===============
    belongs_to :user
    has_many :events, dependent: :destroy
    
    # ===============
    # Callbacks
    # ===============
    before_validation :generate_short_code, on: :create
    
    private

    def generate_short_code
        self.short_code ||= loop do
            code = SecureRandom.alphanumeric(6)
            break code unless Shortlink.exists?(short_code: code)
        end
    end    
end
