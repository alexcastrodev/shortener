require "rails_helper"

RSpec.describe(Forms::Definition) do
  let(:user) { FactoryBot.create(:user) }
  let(:form) { Form.create!(user: user, title: "Form") }

  def add_text(label = "Q")
    described_class.add(form, { "type" => "short_text", "label" => label })
    form.fields.last
  end

  describe ".add" do
    it "appends a field with a generated id and ignores a client id" do
      described_class.add(form, { "id" => "hacked00", "type" => "short_text", "label" => "A" })

      expect(form.reload.fields.size).to(eq(1))
      expect(form.fields.first["id"]).to(match(Forms::FieldSchema::ID_FORMAT))
      expect(form.fields.first["id"]).not_to(eq("hacked00"))
    end

    it "gives ids to choices" do
      described_class.add(form, { "type" => "single_choice", "label" => "A", "choices" => [{ "label" => "x" }, { "label" => "y" }] })

      expect(form.reload.fields.first["choices"].map { |c| c["id"] }).to(all(match(Forms::FieldSchema::ID_FORMAT)))
    end

    it "raises RecordInvalid for an invalid field and stores nothing" do
      expect { described_class.add(form, { "type" => "rating", "label" => "A", "scale" => 7 }) }.to(raise_error(ActiveRecord::RecordInvalid))
      expect(form.reload.fields).to(eq([]))
    end
  end

  describe ".update" do
    it "changes the field in place, keeps its id and can clear help" do
      field = add_text
      described_class.update(form, field["id"], { "label" => "New", "help" => "hint", "required" => true })
      described_class.update(form, field["id"], { "help" => nil })

      stored = form.reload.fields.first
      expect(stored).to(include("id" => field["id"], "label" => "New", "required" => true))
      expect(stored).not_to(have_key("help"))
    end

    it "refuses to change the type" do
      field = add_text

      expect { described_class.update(form, field["id"], { "type" => "email" }) }.to(raise_error(ActiveRecord::RecordInvalid))
      expect(form.reload.fields.first["type"]).to(eq("short_text"))
    end

    it "keeps existing choice ids and gives new choices an id" do
      described_class.add(form, { "type" => "single_choice", "label" => "A", "choices" => [{ "label" => "x" }, { "label" => "y" }] })
      field = form.fields.first
      kept = field["choices"].first

      described_class.update(form, field["id"], { "choices" => [kept, { "label" => "y" }, { "label" => "z" }] })

      choices = form.reload.fields.first["choices"]
      expect(choices.first["id"]).to(eq(kept["id"]))
      expect(choices.map { |c| c["id"] }.uniq.size).to(eq(3))
    end

    it "raises RecordNotFound for an unknown field id" do
      expect { described_class.update(form, "nope1234", { "label" => "x" }) }.to(raise_error(ActiveRecord::RecordNotFound))
    end
  end

  describe ".remove" do
    it "removes only that field" do
      first = add_text("one")
      second = add_text("two")

      described_class.remove(form, first["id"])

      expect(form.reload.fields.map { |f| f["id"] }).to(eq([second["id"]]))
      expect { described_class.remove(form, first["id"]) }.to(raise_error(ActiveRecord::RecordNotFound))
    end
  end

  describe ".reorder" do
    it "applies a permutation of every id" do
      ids = Array.new(3) { |i| add_text("q#{i}")["id"] }

      described_class.reorder(form, ids.reverse)

      expect(form.reload.fields.map { |f| f["id"] }).to(eq(ids.reverse))
    end

    it "rejects missing, extra, repeated and foreign ids without changing anything" do
      ids = Array.new(2) { |i| add_text("q#{i}")["id"] }

      [ids.first(1), ids + ["zzzzzzzz"], [ids.first, ids.first], [ids.first, "zzzzzzzz"]].each do |bad|
        expect { described_class.reorder(form, bad) }.to(raise_error(ActiveRecord::RecordInvalid))
      end
      expect(form.reload.fields.map { |f| f["id"] }).to(eq(ids))
    end
  end

  describe ".apply_template" do
    it "replaces questions, theme and thank you message but keeps the title" do
      add_text

      described_class.apply_template(form, "contact")

      expect(form.reload).to(have_attributes(title: "Form", theme: "default"))
      expect(form.fields.size).to(eq(3))
    end

    it "refuses an unknown template and a form that has responses" do
      expect { described_class.apply_template(form, "community-1") }.to(raise_error(ActiveRecord::RecordInvalid))

      form.update_column(:responses_count, 1)
      expect { described_class.apply_template(form, "contact") }.to(raise_error(ActiveRecord::RecordInvalid))
      expect(form.reload.fields).to(eq([]))
    end
  end

  describe "concurrent edits" do
    it "never loses a field when many are added at once" do
      threads = Array.new(12) do |i|
        Thread.new do
          ActiveRecord::Base.connection_pool.with_connection do
            described_class.add(Form.find(form.id), { "type" => "short_text", "label" => "q#{i}" })
          end
        end
      end
      threads.each(&:join)

      stored = form.reload.fields
      expect(stored.size).to(eq(12))
      expect(stored.map { |f| f["label"] }).to(match_array((0...12).map { |i| "q#{i}" }))
      expect(stored.map { |f| f["id"] }.uniq.size).to(eq(12))
    end
  end
end
