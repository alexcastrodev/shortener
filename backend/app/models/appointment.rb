class Appointment < ApplicationRecord
  HOLDING = ["pending", "unverified", "confirmed"].freeze

  belongs_to :form
  belongs_to :response, class_name: "FormResponse"
  belongs_to :slot, class_name: "AppointmentSlot"

  scope :holding, -> { where(status: HOLDING) }
end
