require "rails_helper"
require Rails.root.join("db/migrate/20261011170300_require_resource_key_of_appointment_slots")

RSpec.describe(RequireResourceKeyOfAppointmentSlots) do
  let(:connection) { ActiveRecord::Base.connection }
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Booking") }
  let(:starts_at) { Time.utc(2026, 11, 2, 9) }

  before { connection.change_column_null(:appointment_slots, :resource_key, true) }

  def raw_slot(service:, resource: nil, at: starts_at)
    connection.select_value(<<~SQL.squish)
      INSERT INTO appointment_slots (form_id, service_key, resource_key, starts_at, booked, created_at, updated_at)
      VALUES (#{form.id}, '#{service}', #{resource ? "'#{resource}'" : "NULL"}, #{connection.quote(at)}, 0, NOW(), NOW()) RETURNING id
    SQL
  end

  def resource_of(id) = connection.select_value("SELECT resource_key FROM appointment_slots WHERE id = #{id}")

  def migrate = ActiveRecord::Migration.suppress_messages { described_class.new.up }

  it "makes every slot without a resource its own resource and leaves the others alone" do
    loose = [raw_slot(service: "cut"), raw_slot(service: "dye", at: starts_at + 1.hour)]
    kept = raw_slot(service: "math", resource: "main", at: starts_at + 2.hours)

    migrate

    expect(loose.map { |id| resource_of(id) }).to(eq(["cut", "dye"]))
    expect(resource_of(kept)).to(eq("main"))
  end

  it "makes the key required and leaves no helper constraint behind" do
    migrate

    expect(connection.columns(:appointment_slots).find { |column| column.name == "resource_key" }.null).to(be(false))
    expect(connection.check_constraints(:appointment_slots).map(&:name)).not_to(include("appointment_slots_resource_key_not_null"))
  end
end
