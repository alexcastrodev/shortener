class AppointmentSlot < ApplicationRecord
  belongs_to :form
  has_many :appointments, foreign_key: :slot_id, inverse_of: :slot, dependent: nil
end
