require "rails_helper"

RSpec.describe(FormResponse, type: :model) do
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Survey") }

  def respond(**attrs)
    FormResponse.create!({ form: form, answers: { "abcd1234" => "hi" } }.merge(attrs))
  end

  it "keeps the form's responses_count in step with creates and deletes" do
    first = respond
    respond
    expect(form.reload.responses_count).to(eq(2))

    first.destroy!
    expect(form.reload.responses_count).to(eq(1))
  end

  it "has only created_at as its timestamp and no personal columns" do
    expect(FormResponse.column_names).to(match_array(["id", "form_id", "answers", "country", "platform", "browser", "source", "idempotency_key", "created_at", "published_version"]))
    expect(respond.created_at).to(be_present)
  end

  it "requires answers to be an object within 32 KB" do
    expect(FormResponse.new(form: form, answers: ["a"])).not_to(be_valid)
    expect(FormResponse.new(form: form, answers: { "a" => "x" * 33_000 })).not_to(be_valid)
    expect(FormResponse.new(form: form, answers: { "a" => "x" * 30_000 })).to(be_valid)
  end

  it "accepts only an upper-case two-letter country" do
    expect(FormResponse.new(form: form, country: "PT")).to(be_valid)
    expect(FormResponse.new(form: form, country: nil)).to(be_valid)
    ["pt", "PRT", "P1", "<s", ""].each do |bad|
      expect(FormResponse.new(form: form, country: bad)).not_to(be_valid)
    end
  end

  it "backs the answers rules in the database" do
    response = respond

    expect { response.update_column(:answers, []) }.to(raise_error(ActiveRecord::StatementInvalid))
    expect { response.update_column(:answers, { "a" => "x" * 70_000 }) }.to(raise_error(ActiveRecord::StatementInvalid))
  end

  it "allows one idempotency key per form, many nils, and the same key in another form" do
    respond(idempotency_key: "key-1")
    respond
    respond

    expect { respond(idempotency_key: "key-1") }.to(raise_error(ActiveRecord::RecordNotUnique))
    other = Form.create!(user: form.user, title: "Other")
    expect(FormResponse.create!(form: other, idempotency_key: "key-1")).to(be_persisted)
  end

  it "is removed with its form" do
    respond
    respond

    expect { form.destroy! }.to(change(FormResponse, :count).by(-2))
  end

  it "is never audited" do
    expect(FormResponse.new).not_to(respond_to(:audits))
    form
    expect { respond }.not_to(change(Audited::Audit, :count))
  end
end

RSpec.describe(FormDailyStat, type: :model) do
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Survey") }

  it "has one row per form and day, starting at zero" do
    stat = FormDailyStat.create!(form: form, day: Date.current)

    expect(stat).to(have_attributes(views: 0, unique_views: 0, starts: 0))
    expect { FormDailyStat.create!(form: form, day: Date.current) }.to(raise_error(ActiveRecord::RecordNotUnique))
    expect(FormDailyStat.create!(form: form, day: Date.current - 1)).to(be_persisted)
  end

  it "is removed with its form" do
    FormDailyStat.create!(form: form, day: Date.current)

    expect { form.destroy! }.to(change(FormDailyStat, :count).by(-1))
  end
end
