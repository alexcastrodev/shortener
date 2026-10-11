require "rails_helper"

RSpec.describe("the resource of an appointment slot") do
  let(:connection) { ActiveRecord::Base.connection }
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Booking") }
  let(:starts_at) { Time.utc(2026, 11, 2, 9) }

  def insert(service:, resource:, at: starts_at)
    connection.execute(<<~SQL.squish)
      INSERT INTO appointment_slots (form_id, service_key, resource_key, starts_at, booked, created_at, updated_at)
      VALUES (#{form.id}, '#{service}', #{resource ? "'#{resource}'" : "NULL"}, #{connection.quote(at)}, 0, NOW(), NOW())
    SQL
  end

  def violates(&block)
    expect { ActiveRecord::Base.transaction(requires_new: true, &block) }.to(raise_error(ActiveRecord::RecordNotUnique))
  end

  it "allows one row per resource and start, whichever service holds it" do
    insert(service: "math", resource: "main")
    violates { insert(service: "physics", resource: "main") }
  end

  it "allows the same start in different resources" do
    insert(service: "math", resource: "math")
    expect { insert(service: "physics", resource: "physics") }.not_to(raise_error)
  end

  it "allows the same resource at another start" do
    insert(service: "math", resource: "main")
    expect { insert(service: "math", resource: "main", at: starts_at + 1.hour) }.not_to(raise_error)
  end
end
