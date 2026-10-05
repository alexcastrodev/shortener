require "rails_helper"

RSpec.describe(DetectFormAbuseJob) do
  let(:owner) { FactoryBot.create(:user) }
  let(:fields) { [{ "id" => "photo001", "type" => "image", "label" => "P" }, { "id" => "name0001", "type" => "short_text", "label" => "N" }] }
  let!(:form) { Form.create!(user: owner, title: "Busy", published: true, fields: fields) }

  def flood(target, count)
    now = Time.current
    rows = Array.new(count) { { form_id: target.id, answers: { "name0001" => "x" }, created_at: now } }
    FormResponse.insert_all(rows)
  end

  before { allow(Sentry).to(receive(:capture_message)) }

  it "unpublishes a form that received too many responses in an hour, raises one signal and alerts" do
    flood(form, DetectFormAbuseJob::MAX_RESPONSES + 1)

    described_class.perform_now
    described_class.perform_now

    expect(form.reload.published).to(be(false))
    signal = AbuseSignal.find_by!(kind: "form_flood")
    expect(signal).to(have_attributes(form_ids: [form.id], user_ids: [owner.id], status: "open"))
    expect(AbuseSignal.count).to(eq(1))
    expect(Sentry).to(have_received(:capture_message).once.with(/unpublished automatically: 601 responses/, anything))
  end

  it "leaves busy but normal forms, old bursts and other forms alone" do
    quiet = Form.create!(user: owner, title: "Quiet", published: true, fields: fields)
    flood(quiet, DetectFormAbuseJob::MAX_RESPONSES)
    old = Form.create!(user: owner, title: "Old burst", published: true, fields: fields)
    FormResponse.insert_all(Array.new(DetectFormAbuseJob::MAX_RESPONSES + 50) { { form_id: old.id, answers: {}, created_at: 3.hours.ago } })

    described_class.perform_now

    expect(quiet.reload.published).to(be(true))
    expect(old.reload.published).to(be(true))
    expect(AbuseSignal.count).to(eq(0))
  end

  it "unpublishes a form whose uploads exceed the hourly volume" do
    stub_const("DetectFormAbuseJob::MAX_UPLOAD_BYTES", 10)
    upload = form.uploads.create!(field_id: "photo001")
    upload.file.attach(io: StringIO.new("x" * 50), filename: "image.webp", content_type: "image/webp")

    described_class.perform_now

    expect(form.reload.published).to(be(false))
    expect(AbuseSignal.find_by!(kind: "form_flood").form_ids).to(eq([form.id]))
    expect(Sentry).to(have_received(:capture_message).with(/MB of uploads|0 MB/, anything))
  end

  it "does not touch a form that is already unpublished or an unrelated signal" do
    form.update!(published: false)
    flood(form, DetectFormAbuseJob::MAX_RESPONSES + 5)

    described_class.perform_now

    expect(AbuseSignal.count).to(eq(0))
  end

  it "reopens a dismissed signal if the same form floods again the same day" do
    flood(form, DetectFormAbuseJob::MAX_RESPONSES + 1)
    described_class.perform_now
    AbuseSignal.last.dismiss!
    form.reload.update!(published: true)

    described_class.perform_now

    expect(AbuseSignal.count).to(eq(1))
    expect(AbuseSignal.last.status).to(eq("open"))
  end
end
