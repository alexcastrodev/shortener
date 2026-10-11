require "rails_helper"
require Rails.root.join("db/migrate/20261011170100_backfill_resource_key_of_appointment_slots")

RSpec.describe(BackfillResourceKeyOfAppointmentSlots) do
  let(:connection) { ActiveRecord::Base.connection }
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Booking") }
  let(:starts_at) { Time.utc(2026, 11, 2, 9) }

  def raw_slot(service:, resource: nil, at: starts_at)
    connection.select_value(<<~SQL.squish)
      INSERT INTO appointment_slots (form_id, service_key, resource_key, starts_at, booked, created_at, updated_at)
      VALUES (#{form.id}, '#{service}', #{resource ? "'#{resource}'" : "NULL"}, #{connection.quote(at)}, 0, NOW(), NOW()) RETURNING id
    SQL
  end

  def resource_of(id) = connection.select_value("SELECT resource_key FROM appointment_slots WHERE id = #{id}")

  def migrate = ActiveRecord::Migration.suppress_messages { described_class.new.up }

  it "makes every slot its own resource" do
    ids = [raw_slot(service: "cut"), raw_slot(service: "dye"), raw_slot(service: "cut", at: starts_at + 1.hour)]
    migrate
    expect(ids.map { |id| resource_of(id) }).to(eq(["cut", "dye", "cut"]))
  end

  it "leaves a slot that already has a resource alone and can run again" do
    kept = raw_slot(service: "math", resource: "main")
    loose = raw_slot(service: "cut", at: starts_at + 2.hours)
    migrate
    migrate
    expect([resource_of(kept), resource_of(loose)]).to(eq(["main", "cut"]))
  end
end
