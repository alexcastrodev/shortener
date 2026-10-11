require "rails_helper"

RSpec.describe("overlapping time in a shared resource") do
  let(:connection) { ActiveRecord::Base.connection }
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Teacher") }
  let(:other_form) { Form.create!(user: FactoryBot.create(:user), title: "Other") }
  let(:ten) { Time.utc(2026, 11, 2, 10) }

  def insert(service:, resource:, at: ten, minutes: 60, booked: 1, owner: form)
    ends = minutes && at + minutes.minutes
    connection.execute(<<~SQL.squish)
      INSERT INTO appointment_slots (form_id, service_key, resource_key, starts_at, ends_at, booked, created_at, updated_at)
      VALUES (#{owner.id}, '#{service}', '#{resource}', #{connection.quote(at)}, #{ends ? connection.quote(ends) : "NULL"}, #{booked}, NOW(), NOW())
    SQL
  end

  def violates(&block)
    expect { ActiveRecord::Base.transaction(requires_new: true, &block) }.to(raise_error(ActiveRecord::ExclusionViolation))
  end

  it "refuses a booking that starts inside another one of the same resource" do
    insert(service: "math", resource: "main")
    violates { insert(service: "physics", resource: "main", at: ten + 30.minutes, minutes: 90) }
  end

  it "refuses one that covers another" do
    insert(service: "math", resource: "main", at: ten + 15.minutes, minutes: 15)
    violates { insert(service: "physics", resource: "main", minutes: 90) }
  end

  it "allows back to back bookings" do
    insert(service: "math", resource: "main")
    expect { insert(service: "physics", resource: "main", at: ten + 60.minutes) }.not_to(raise_error)
    expect { insert(service: "math", resource: "main", at: ten - 60.minutes) }.not_to(raise_error)
  end

  it "ignores a time that has no booking or no end" do
    insert(service: "math", resource: "main", booked: 0)
    expect { insert(service: "physics", resource: "main", at: ten + 10.minutes) }.not_to(raise_error)
    expect { insert(service: "dye", resource: "main", at: ten + 20.minutes, minutes: nil) }.not_to(raise_error)
  end

  it "leaves services that are their own resource free to overlap, as they always could" do
    insert(service: "cut", resource: "cut")
    expect { insert(service: "cut", resource: "cut", at: ten + 30.minutes) }.not_to(raise_error)
  end

  it "keeps resources and forms apart" do
    insert(service: "math", resource: "main")
    expect { insert(service: "piano", resource: "other") }.not_to(raise_error)
    expect { insert(service: "math", resource: "main", owner: other_form) }.not_to(raise_error)
  end
end
