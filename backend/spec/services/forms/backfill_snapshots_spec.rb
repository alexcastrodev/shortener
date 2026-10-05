require "rails_helper"

RSpec.describe(Forms::BackfillSnapshots) do
  let(:user) { FactoryBot.create(:user) }
  let(:field) { { "id" => "abcd1234", "type" => "yes_no", "label" => "Ok?" } }

  def make_form(**attrs)
    Form.create!({ user: user, title: "Survey", fields: [field] }.merge(attrs))
  end

  def clear_snapshot(form)
    form.update_columns(published_snapshot: nil, published_version: 0, published_digest: nil)
  end

  it "snapshots published forms at version 1 with a digest" do
    form = make_form(published: true, description: "Two minutes", layout: "page")
    clear_snapshot(form)

    described_class.call
    form.reload

    expect(form.published_version).to(eq(1))
    expect(form.published_snapshot).to(include("title" => "Survey", "description" => "Two minutes", "layout" => "page", "fields" => [field]))
    expect(form.published_digest).to(match(/\A\h{64}\z/))
  end

  it "leaves drafts without a snapshot" do
    form = make_form(published: false)
    described_class.call
    form.reload
    expect(form.published_snapshot).to(be_nil)
    expect(form.published_version).to(eq(0))
    expect(form.published_digest).to(be_nil)
  end

  it "tags existing responses of published forms with version 1" do
    form = make_form(published: true)
    clear_snapshot(form)
    response = FormResponse.create!(form: form, answers: {})
    described_class.call
    expect(response.reload.published_version).to(eq(1))
  end

  it "is idempotent and never overwrites an existing snapshot" do
    form = make_form(published: true)
    clear_snapshot(form)
    described_class.call
    form.update_columns(title: "Renamed")
    digest = form.reload.published_digest

    described_class.call
    form.reload

    expect(form.published_snapshot["title"]).to(eq("Survey"))
    expect(form.published_digest).to(eq(digest))
    expect(form.published_version).to(eq(1))
  end
end
