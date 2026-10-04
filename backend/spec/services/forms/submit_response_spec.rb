require "rails_helper"

RSpec.describe(Forms::SubmitResponse) do
  let(:user) { FactoryBot.create(:user) }
  let(:choice_ids) { ["aaaaaaa1", "bbbbbbb2"] }
  let(:fields) do
    [
      { "id" => "name0001", "type" => "short_text", "label" => "Name", "required" => true },
      { "id" => "mail0001", "type" => "email", "label" => "Mail" },
      { "id" => "pick0001", "type" => "single_choice", "label" => "Pick", "choices" => choice_ids.map { |id| { "id" => id, "label" => id } } },
      { "id" => "rate0001", "type" => "rating", "label" => "Rate", "scale" => 5 },
    ]
  end
  let(:form) { Form.create!(user: user, title: "Survey", fields: fields) }

  def submit(answers, **options)
    described_class.call(form: form, answers: answers, **options)
  end

  it "stores the cast answers and bumps the counter" do
    result = submit({ "name0001" => " Ana ", "mail0001" => "ana@example.com", "pick0001" => "aaaaaaa1", "rate0001" => 4 })

    expect(result.created).to(be(true))
    expect(result.errors).to(be_nil)
    expect(result.response.answers).to(eq("name0001" => "Ana", "mail0001" => "ana@example.com", "pick0001" => "aaaaaaa1", "rate0001" => 4))
    expect(form.reload.responses_count).to(eq(1))
  end

  it "leaves unanswered optional questions out" do
    result = submit({ "name0001" => "Ana" })

    expect(result.response.answers).to(eq("name0001" => "Ana"))
  end

  it "drops keys that are not questions of the form" do
    result = submit({ "name0001" => "Ana", "evil0000" => "x", "user_id" => 1, "__proto__" => "y" })

    expect(result.response.answers.keys).to(eq(["name0001"]))
  end

  it "reports every invalid answer by field id without echoing values" do
    result = submit({ "name0001" => "", "mail0001" => "not-an-email-CNRY", "pick0001" => "zzzzzzz9", "rate0001" => 6 })

    expect(result.response).to(be_nil)
    expect(result.errors).to(eq("name0001" => ["blank"], "mail0001" => ["invalid"], "pick0001" => ["invalid"], "rate0001" => ["out_of_range"]))
    expect(result.errors.to_s).not_to(include("CNRY"))
    expect(form.reload.responses_count).to(eq(0))
    expect(FormResponse.count).to(eq(0))
  end

  it "judges answers against the current definition of the form" do
    form.update!(fields: fields + [{ "id" => "late0001", "type" => "yes_no", "label" => "New", "required" => true }])

    expect(submit({ "name0001" => "Ana" }).errors).to(eq("late0001" => ["blank"]))
  end

  it "rejects answers that are not an object" do
    ["text", ["a"], nil, 5].each do |bad|
      expect(submit(bad).errors).to(eq("answers" => ["invalid"]))
    end
  end

  describe "idempotency" do
    it "returns the first response for a repeated key and stores nothing twice" do
      first = submit({ "name0001" => "Ana" }, idempotency_key: "retry-1")
      again = submit({ "name0001" => "Ana" }, idempotency_key: "retry-1")

      expect(first.created).to(be(true))
      expect(again.created).to(be(false))
      expect(again.response.id).to(eq(first.response.id))
      expect(form.reload.responses_count).to(eq(1))
    end

    it "does not validate a retry again: the stored response wins" do
      first = submit({ "name0001" => "Ana" }, idempotency_key: "retry-2")
      again = submit({ "name0001" => "" }, idempotency_key: "retry-2")

      expect(again.response.id).to(eq(first.response.id))
      expect(again.errors).to(be_nil)
    end

    it "keeps keys independent between forms" do
      other = Form.create!(user: user, title: "Other", fields: fields)
      submit({ "name0001" => "Ana" }, idempotency_key: "same")

      result = described_class.call(form: other, answers: { "name0001" => "Bo" }, idempotency_key: "same")
      expect(result.created).to(be(true))
    end

    it "stores exactly one response when the same key arrives in parallel" do
      form
      allow_any_instance_of(described_class).to(receive(:find_existing).and_wrap_original do |original|
        found = original.call
        sleep(0.2)
        found
      end)
      results = Array.new(10) do
        Thread.new do
          ActiveRecord::Base.connection_pool.with_connection do
            described_class.call(form: Form.find(form.id), answers: { "name0001" => "Ana" }, idempotency_key: "burst")
          end
        end
      end.map(&:value)

      expect(results.count(&:created)).to(eq(1))
      expect(results.map { |r| r.response.id }.uniq.size).to(eq(1))
      expect(FormResponse.where(form_id: form.id).count).to(eq(1))
      expect(form.reload.responses_count).to(eq(1))
    end
  end

  describe "request metadata" do
    it "keeps a valid country, trims device fields and ignores everything else" do
      result = submit({ "name0001" => "Ana" }, meta: { country: "PT", platform: "iOS", browser: "Safari", source: "x" * 100, ip: "203.0.113.77", user_agent: "Mozilla" })

      expect(result.response).to(have_attributes(country: "PT", platform: "iOS", browser: "Safari"))
      expect(result.response.source.length).to(eq(40))
      expect(result.response.attributes.values.join(" ")).not_to(include("203.0.113.77"))
    end

    it "drops a country that is not two capital letters" do
      ["pt", "PRT", "<s", "", nil].each do |bad|
        expect(submit({ "name0001" => "Ana" }, meta: { country: bad }).response.country).to(be_nil)
      end
    end
  end
end
