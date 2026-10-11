require "rails_helper"
require Rails.root.join("db/migrate/20261011090000_remove_bundle_from_booking_services")

RSpec.describe(RemoveBundleFromBookingServices) do
  let(:user) { FactoryBot.create(:user) }
  let(:bundle) { { "take" => 5, "pay" => 4 } }
  let(:service) { { "id" => "abc12345", "name" => "Class", "duration" => 60, "price" => 12.5, "currency" => "EUR", "days" => ["mon"], "times" => ["09:00"] } }
  let(:question) { { "id" => "qqqq1111", "type" => "short_text", "label" => "Bundle", "choices" => [{ "bundle" => "kept" }] } }

  def booking(extra = {}) = { "id" => "bbbb2222", "type" => "booking", "label" => "When", "services" => [service.merge(extra)], "rules" => {} }

  def migrate = ActiveRecord::Migration.suppress_messages { described_class.new.up }

  def digest(form) = ActiveRecord::Base.connection.select_value("SELECT encode(sha256(convert_to(published_snapshot::text, 'UTF8')), 'hex') FROM forms WHERE id = #{form.id}")

  it "removes the bundle from the draft and the published snapshot and refreshes the digest" do
    form = Form.create!(user: user, title: "Studio")
    form.update_columns(fields: [question, booking("bundle" => bundle)], published_snapshot: { "title" => "Studio", "fields" => [question, booking("bundle" => bundle)] }, published_digest: "stale")

    migrate

    form.reload
    expect(form.fields).to(eq([question, booking]))
    expect(form.published_snapshot["fields"]).to(eq([question, booking]))
    expect(form.published_digest).to(eq(digest(form)))
  end

  it "leaves forms without a bundle untouched" do
    form = Form.create!(user: user, title: "Plain")
    form.update_columns(fields: [booking], published_snapshot: { "title" => "Plain", "fields" => [booking] }, published_digest: "keep")

    migrate

    expect(form.reload.published_digest).to(eq("keep"))
  end

  it "handles a draft that was never published" do
    form = Form.create!(user: user, title: "Draft")
    form.update_columns(fields: [booking("bundle" => bundle)], published_snapshot: nil)

    migrate

    expect(form.reload.fields).to(eq([booking]))
    expect(form.published_snapshot).to(be_nil)
  end
end
