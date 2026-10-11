require "rails_helper"

RSpec.describe(AppointmentSlot, type: :model) do
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Booking") }
  let(:starts_at) { Time.utc(2026, 11, 2, 9) }

  it "is its own resource unless it is given one" do
    slot = described_class.create!(form: form, service_key: "cut", starts_at: starts_at)
    expect(slot.resource_key).to(eq("cut"))
  end

  it "keeps the resource it is given" do
    slot = described_class.create!(form: form, service_key: "cut", resource_key: "main", starts_at: starts_at)
    expect(slot.resource_key).to(eq("main"))
  end
end
