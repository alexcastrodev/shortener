require "rails_helper"

RSpec.describe(BuiltInFormTemplates) do
  it "offers the six templates of the plan" do
    expect(described_class.all.map { |t| t["id"] }).to(match_array(["contact", "feedback", "event_rsvp", "satisfaction", "bug_report", "waitlist"]))
  end

  described_class.all.each do |template|
    describe template["id"] do
      let(:built) { described_class.build(template["id"]) }

      it "builds fields that pass the form rules, with unique ids" do
        expect(Forms::FieldSchema.definition_errors(built["fields"])).to(eq([]))
        ids = built["fields"].flat_map { |f| [f["id"], *Array(f["choices"]).map { |c| c["id"] }] }
        expect(ids.uniq.size).to(eq(ids.size))
      end

      it "makes a valid unpublished form" do
        form = Form.new(user: FactoryBot.create(:user), title: built["title"], theme: built["theme"], thank_you_message: built["thank_you_message"], fields: built["fields"])
        expect(form).to(be_valid)
        expect(form.published).to(be(false))
      end

      it "gets fresh ids on every build" do
        other = described_class.build(template["id"])
        expect(other["fields"].map { |f| f["id"] }).not_to(eq(built["fields"].map { |f| f["id"] }))
      end

      it "has a name, description and a known theme" do
        expect(template.values_at("name", "description")).to(all(be_present))
        expect(Page::THEMES).to(include(template["theme"]))
      end
    end
  end

  it "finds by id and returns nil for unknown or user-controlled ids" do
    expect(described_class.find("contact")["id"]).to(eq("contact"))
    expect(described_class.find("community-1")).to(be_nil)
    expect(described_class.build("nope")).to(be_nil)
  end

  it "never leaves the shared templates mutated by a build" do
    before = described_class.find("event_rsvp").to_json
    described_class.build("event_rsvp")
    expect(described_class.find("event_rsvp").to_json).to(eq(before))
  end

  describe "in European Portuguese" do
    described_class.all.each do |template|
      it "translates #{template["id"]} question by question, keeping the structure and passing the form rules" do
        english = described_class.build(template["id"])
        portuguese = described_class.build(template["id"], locale: "pt-PT")
        expect(portuguese["title"]).not_to(eq(english["title"]))
        expect(portuguese["thank_you_message"]).not_to(eq(english["thank_you_message"]))
        expect(portuguese["fields"].map { |f| [f["type"], f["required"], f["scale"], f["min"], f["max"]] }).to(eq(english["fields"].map { |f| [f["type"], f["required"], f["scale"], f["min"], f["max"]] }))
        expect(portuguese["fields"].map { |f| f["label"] }).not_to(eq(english["fields"].map { |f| f["label"] }))
        expect(portuguese["fields"].map { |f| Array(f["choices"]).size }).to(eq(english["fields"].map { |f| Array(f["choices"]).size }))
        expect(portuguese["fields"].map { |f| f.key?("help") }).to(eq(english["fields"].map { |f| f.key?("help") }))
        expect(Forms::FieldSchema.definition_errors(portuguese["fields"])).to(eq([]))
      end
    end

    it "keeps English for any other language and for no language" do
      expect(described_class.build("contact", locale: "en")["title"]).to(eq("Get in touch"))
      expect(described_class.build("contact", locale: nil)["title"]).to(eq("Get in touch"))
      expect(described_class.build("contact", locale: "fr")["title"]).to(eq("Get in touch"))
    end

    it "has a text for every template, so none is left in English by mistake" do
      expect(BuiltInFormTemplatesPt::TEXTS.keys).to(match_array(described_class::TEMPLATES.map { |t| t["id"] }))
    end
  end
end
