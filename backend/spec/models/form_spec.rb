require "rails_helper"

RSpec.describe(Form, type: :model) do
  let(:user) { FactoryBot.create(:user) }

  def build_form(**attrs)
    Form.new({ user: user, title: "Contact" }.merge(attrs))
  end

  it "is created unpublished with an empty field list and a 12 character public id" do
    form = build_form
    form.save!

    expect(form.published).to(be(false))
    expect(form.fields).to(eq([]))
    expect(form.responses_count).to(eq(0))
    expect(form.public_id).to(match(/\A[A-Za-z0-9]{12}\z/))
  end

  it "gives every form its own public id" do
    ids = Array.new(5) { build_form.tap(&:save!).public_id }

    expect(ids.uniq.size).to(eq(5))
  end

  it "validates title, description, thank you message and theme" do
    expect(build_form(title: "")).not_to(be_valid)
    expect(build_form(title: "a" * 121)).not_to(be_valid)
    expect(build_form(description: "a" * 1001)).not_to(be_valid)
    expect(build_form(thank_you_message: "a" * 501)).not_to(be_valid)
    expect(build_form(theme: "neon")).not_to(be_valid)
    expect(build_form(title: "a" * 120, description: "a" * 1000, thank_you_message: "a" * 500)).to(be_valid)
  end

  it "rejects fields that are not an array, in the model and in the database" do
    form = build_form(fields: { "a" => 1 })
    expect(form).not_to(be_valid)

    form = build_form.tap(&:save!)
    expect { form.update_column(:fields, { "a" => 1 }) }.to(raise_error(ActiveRecord::StatementInvalid))
  end

  it "runs the field definition rules" do
    valid = [{ "id" => "abcd1234", "type" => "yes_no", "label" => "Ok?" }]
    expect(build_form(fields: valid)).to(be_valid)

    form = build_form(fields: [{ "id" => "abcd1234", "type" => "file", "label" => "x" }])
    expect(form).not_to(be_valid)
    expect(form.errors[:fields]).not_to(be_empty)
  end

  describe ".visible" do
    it "is only published forms of active owners" do
      live = build_form(published: true).tap(&:save!)
      build_form(published: false).save!
      gone = FactoryBot.create(:user, deactivated_at: Time.current)
      Form.create!(user: gone, title: "x", published: true)

      expect(Form.visible).to(contain_exactly(live))
    end
  end

  it "audits only title and published" do
    form = build_form.tap(&:save!)
    form.update!(title: "New", description: "private note", thank_you_message: "thanks", published: true)

    changes = form.audits.map(&:audited_changes).reduce({}, :merge)
    expect(changes.keys).to(match_array(["title", "published"]))
  end

  it "is destroyed with its owner" do
    build_form.save!
    expect { user.destroy! }.to(change(Form, :count).by(-1))
  end
end
