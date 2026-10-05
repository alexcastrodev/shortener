require "rails_helper"

RSpec.describe("appointment tables") do
  let(:connection) { ActiveRecord::Base.connection }
  let(:user) { FactoryBot.create(:user) }
  let(:form) { Form.create!(user: user, title: "Booking") }
  let(:response_row) { FormResponse.create!(form: form, answers: {}) }
  let(:starts_at) { Time.utc(2026, 11, 2, 9) }

  def insert_slot(capacity: 2, booked: 0, at: starts_at)
    connection.select_value(<<~SQL)
      INSERT INTO appointment_slots (form_id, service_key, starts_at, capacity, booked, created_at, updated_at)
      VALUES (#{form.id}, 'cut', #{connection.quote(at)}, #{capacity || "NULL"}, #{booked}, NOW(), NOW()) RETURNING id
    SQL
  end

  def insert_appointment(slot_id)
    connection.select_value(<<~SQL)
      INSERT INTO appointments (form_id, response_id, slot_id, group_key, status, created_at)
      VALUES (#{form.id}, #{response_row.id}, #{slot_id}, '#{SecureRandom.uuid}', 'pending', NOW())
      RETURNING id
    SQL
  end

  def violates(&block)
    expect { ActiveRecord::Base.transaction(requires_new: true, &block) }.to(raise_error(ActiveRecord::StatementInvalid))
  end

  it "rejects a negative booked counter" do
    violates { insert_slot(booked: -1) }
  end

  it "rejects booked above capacity" do
    violates { insert_slot(capacity: 1, booked: 2) }
  end

  it "accepts any booked count when capacity is unlimited" do
    expect { insert_slot(capacity: nil, booked: 50) }.not_to(raise_error)
  end

  it "keeps one slot per form, service and start" do
    insert_slot
    violates { insert_slot }
  end

  it "stores the booking atomically: the counter only moves while there is room" do
    id = insert_slot(capacity: 1)
    take = "UPDATE appointment_slots SET booked = booked + 1 WHERE id = #{id} AND (capacity IS NULL OR booked < capacity)"
    expect(connection.exec_update(take)).to(eq(1))
    expect(connection.exec_update(take)).to(eq(0))
  end

  it "deletes appointments and their tokens when the response is deleted" do
    appointment_id = insert_appointment(insert_slot)
    connection.execute("INSERT INTO appointment_tokens (appointment_id, purpose, digest, expires_at, created_at) VALUES (#{appointment_id}, 'manage', 'd1', NOW() + interval '1 day', NOW())")

    response_row.destroy!

    expect(connection.select_value("SELECT COUNT(*) FROM appointments")).to(eq(0))
    expect(connection.select_value("SELECT COUNT(*) FROM appointment_tokens")).to(eq(0))
  end

  it "refuses to delete a slot that still has appointments" do
    slot_id = insert_slot
    insert_appointment(slot_id)
    violates { connection.execute("DELETE FROM appointment_slots WHERE id = #{slot_id}") }
  end

  it "only accepts known token purposes and a unique digest" do
    appointment_id = insert_appointment(insert_slot)
    token = ->(purpose, digest) { connection.execute("INSERT INTO appointment_tokens (appointment_id, purpose, digest, expires_at, created_at) VALUES (#{appointment_id}, '#{purpose}', '#{digest}', NOW(), NOW())") }
    violates { token.call("admin", "d2") }
    token.call("approve", "d3")
    violates { token.call("decline", "d3") }
  end

  it "only accepts known decided_by and cancelled_by values" do
    slot_id = insert_slot
    violates { connection.execute("INSERT INTO appointments (form_id, response_id, slot_id, group_key, status, decided_by, created_at) VALUES (#{form.id}, #{response_row.id}, #{slot_id}, '#{SecureRandom.uuid}', 'pending', 'robot', NOW())") }
    violates { connection.execute("INSERT INTO appointments (form_id, response_id, slot_id, group_key, status, cancelled_by, created_at) VALUES (#{form.id}, #{response_row.id}, #{slot_id}, '#{SecureRandom.uuid}', 'cancelled', 'robot', NOW())") }
  end
end
