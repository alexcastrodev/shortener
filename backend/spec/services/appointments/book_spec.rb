require "rails_helper"

RSpec.describe(Appointments::Book) do
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00", "11:00"] } }
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Salon") }
  let(:fields) { form.reload.fields }
  let(:booking_id) { fields.find { |field| field["type"] == "booking" }["id"] }
  let(:service_id) { fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
  let(:name_id) { fields.find { |field| field["type"] == "short_text" }["id"] }

  before do
    travel_to(Time.utc(2026, 11, 2, 8))
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => { "max_per_day" => 1 } })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def submit(time)
    answers = { name_id => "Ana", booking_id => { "service" => service_id, "sessions" => [{ "date" => "2026-11-03", "time" => time }] } }
    Forms::SubmitResponse.call(form: form, answers: answers).created ? :booked : :refused
  rescue described_class::Full
    :full
  end

  it "keeps the per-day limit when two visitors book different times of the same day at once" do
    arrived = Queue.new
    go = Queue.new
    allow(described_class).to(receive(:cast).and_wrap_original do |original, **args|
      original.call(**args).tap do
        arrived << true
        go.pop(timeout: 10)
      end
    end)

    threads = ["09:00", "10:00"].map { |time| Thread.new { ActiveRecord::Base.connection_pool.with_connection { submit(time) } } }
    2.times { arrived.pop(timeout: 10) }
    2.times { go << true }

    expect(threads.map(&:value).tally).to(eq(booked: 1, full: 1))
    expect(AppointmentSlot.where(form_id: form.id).sum(:booked)).to(eq(1))
    expect(Appointment.count).to(eq(1))
  end
end
