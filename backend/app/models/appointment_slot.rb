class AppointmentSlot < ApplicationRecord
  before_validation { self.resource_key ||= service_key }

  scope :of_resource, ->(key) { where("resource_key = :key OR (resource_key IS NULL AND service_key = :key)", key: key) }

  belongs_to :form
  has_many :appointments, foreign_key: :slot_id, inverse_of: :slot, dependent: nil
end
