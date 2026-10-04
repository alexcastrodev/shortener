require "rails_helper"

RSpec.describe(Forms::FieldSchema) do
  def field(type, **extra)
    { "id" => "abcd1234", "type" => type, "label" => "Question" }.merge(extra.transform_keys(&:to_s))
  end

  def choices(*ids)
    ids.map { |id| { "id" => id, "label" => id } }
  end

  let(:choice_ids) { ["aaaaaaa1", "bbbbbbb2", "ccccccc3"] }

  describe ".definition_errors" do
    it "accepts one valid field of every type" do
      fields = [
        field("short_text"),
        field("long_text", help: "More", required: true),
        field("email"),
        field("number", min: 0, max: 10),
        field("single_choice", choices: choices(*choice_ids)),
        field("multiple_choice", choices: choices(*choice_ids), max_choices: 2),
        field("yes_no"),
        field("rating", scale: 10),
        field("date"),
      ].each_with_index.map { |f, i| f.merge("id" => "field00#{i}") }

      expect(described_class.definition_errors(fields)).to(eq([]))
    end

    it "accepts symbol keys and an empty list" do
      expect(described_class.definition_errors([])).to(eq([]))
      expect(described_class.definition_errors([{ id: "abcd1234", type: "yes_no", label: "Ok?" }])).to(eq([]))
    end

    [
      ["not an array", { "a" => 1 }],
      ["an element that is not an object", ["text"]],
      ["unknown type", [{ "id" => "abcd1234", "type" => "file", "label" => "x" }]],
      ["missing label", [{ "id" => "abcd1234", "type" => "yes_no" }]],
      ["blank label", [{ "id" => "abcd1234", "type" => "yes_no", "label" => "  " }]],
      ["label too long", [{ "id" => "abcd1234", "type" => "yes_no", "label" => "a" * 301 }]],
      ["help too long", [{ "id" => "abcd1234", "type" => "yes_no", "label" => "x", "help" => "a" * 501 }]],
      ["NUL in label", [{ "id" => "abcd1234", "type" => "yes_no", "label" => "a\u0000b" }]],
      ["short id", [{ "id" => "abc", "type" => "yes_no", "label" => "x" }]],
      ["id with symbols", [{ "id" => "abcd-234", "type" => "yes_no", "label" => "x" }]],
      ["required not boolean", [{ "id" => "abcd1234", "type" => "yes_no", "label" => "x", "required" => "yes" }]],
      ["unknown key", [{ "id" => "abcd1234", "type" => "yes_no", "label" => "x", "evil" => 1 }]],
      ["scale on a text field", [{ "id" => "abcd1234", "type" => "short_text", "label" => "x", "scale" => 5 }]],
      ["rating without a valid scale", [{ "id" => "abcd1234", "type" => "rating", "label" => "x", "scale" => 7 }]],
      ["number with min above max", [{ "id" => "abcd1234", "type" => "number", "label" => "x", "min" => 5, "max" => 1 }]],
      ["number bound that is not a number", [{ "id" => "abcd1234", "type" => "number", "label" => "x", "min" => "1" }]],
    ].each do |name, fields|
      it "rejects #{name}" do
        expect(described_class.definition_errors(fields)).not_to(be_empty)
      end
    end

    it "rejects repeated field ids" do
      fields = [field("yes_no"), field("yes_no")]
      expect(described_class.definition_errors(fields)).not_to(be_empty)
    end

    it "rejects choice fields with fewer than two, repeated or malformed choices" do
      expect(described_class.definition_errors([field("single_choice", choices: choices("aaaaaaa1"))])).not_to(be_empty)
      expect(described_class.definition_errors([field("single_choice", choices: choices("aaaaaaa1", "aaaaaaa1"))])).not_to(be_empty)
      expect(described_class.definition_errors([field("single_choice", choices: [{ "id" => "aaaaaaa1", "label" => "" }, { "id" => "bbbbbbb2", "label" => "b" }])])).not_to(be_empty)
      expect(described_class.definition_errors([field("single_choice", choices: [{ "id" => "aaaaaaa1", "label" => "a", "x" => 1 }, { "id" => "bbbbbbb2", "label" => "b" }])])).not_to(be_empty)
      expect(described_class.definition_errors([field("single_choice", choices: [{ "id" => "aaaaaaa1", "label" => "a" * 101 }, { "id" => "bbbbbbb2", "label" => "b" }])])).not_to(be_empty)
    end

    it "rejects max_choices outside 1..choices or on a single choice" do
      expect(described_class.definition_errors([field("multiple_choice", choices: choices(*choice_ids), max_choices: 4)])).not_to(be_empty)
      expect(described_class.definition_errors([field("multiple_choice", choices: choices(*choice_ids), max_choices: 0)])).not_to(be_empty)
      expect(described_class.definition_errors([field("single_choice", choices: choices(*choice_ids), max_choices: 2)])).not_to(be_empty)
    end
  end

  describe ".cast_answer" do
    def cast(type, raw, **extra)
      described_class.cast_answer(field(type, **extra), raw)
    end

    it "treats blank as unanswered, or as an error when required" do
      expect(cast("short_text", nil)).to(eq([nil, nil]))
      expect(cast("short_text", "  ")).to(eq([nil, nil]))
      expect(cast("multiple_choice", [], choices: choices(*choice_ids))).to(eq([nil, nil]))
      expect(cast("short_text", "", required: true)).to(eq([nil, :blank]))
      expect(cast("yes_no", nil, required: true)).to(eq([nil, :blank]))
    end

    it "keeps false as an answer for yes_no" do
      expect(cast("yes_no", false, required: true)).to(eq([false, nil]))
      expect(cast("yes_no", true)).to(eq([true, nil]))
      expect(cast("yes_no", "true")).to(eq([nil, :invalid]))
    end

    it "validates text length, type and NUL" do
      expect(cast("short_text", " hello ")).to(eq(["hello", nil]))
      expect(cast("short_text", "a" * 500)).to(eq(["a" * 500, nil]))
      expect(cast("short_text", "a" * 501)).to(eq([nil, :too_long]))
      expect(cast("long_text", "a" * 5000).last).to(be_nil)
      expect(cast("long_text", "a" * 5001)).to(eq([nil, :too_long]))
      expect(cast("short_text", 5)).to(eq([nil, :invalid]))
      expect(cast("short_text", ["a"])).to(eq([nil, :invalid]))
      expect(cast("short_text", "a\u0000b")).to(eq([nil, :invalid]))
    end

    it "validates e-mail addresses" do
      expect(cast("email", "ana@example.com")).to(eq(["ana@example.com", nil]))
      ["no-at", "a@b", "ana@example.com\r\nBcc: x@y.z", "a b@example.com", "ana@@example.com"].each do |bad|
        expect(cast("email", bad).last).to(eq(:invalid))
      end
      expect(cast("email", "#{"a" * 250}@example.com")).to(eq([nil, :too_long]))
      expect(cast("email", 5)).to(eq([nil, :invalid]))
    end

    it "validates numbers" do
      expect(cast("number", 5)).to(eq([5, nil]))
      expect(cast("number", "12.5")).to(eq([12.5, nil]))
      expect(cast("number", 3.0)).to(eq([3, nil]))
      expect(cast("number", 1_000_000_000_000)).to(eq([1_000_000_000_000, nil]))
      expect(cast("number", 1_000_000_000_001)).to(eq([nil, :out_of_range]))
      expect(cast("number", "1.23456")).to(eq([nil, :invalid]))
      ["abc", "1e5", "--1", "NaN", "Infinity", true, { "a" => 1 }].each do |bad|
        expect(cast("number", bad).last).to(eq(:invalid))
      end
      expect(cast("number", Float::NAN)).to(eq([nil, :invalid]))
      expect(cast("number", Float::INFINITY)).to(eq([nil, :invalid]))
      expect(cast("number", JSON.parse("[1e999]").first)).to(eq([nil, :invalid]))
      expect(cast("number", 11, min: 0, max: 10)).to(eq([nil, :out_of_range]))
      expect(cast("number", -1, min: 0, max: 10)).to(eq([nil, :out_of_range]))
      expect(cast("number", 10, min: 0, max: 10)).to(eq([10, nil]))
    end

    it "accepts only choice ids that exist" do
      extra = { choices: choices(*choice_ids) }
      expect(cast("single_choice", "aaaaaaa1", **extra)).to(eq(["aaaaaaa1", nil]))
      expect(cast("single_choice", "zzzzzzz9", **extra)).to(eq([nil, :invalid]))
      expect(cast("single_choice", ["aaaaaaa1"], **extra)).to(eq([nil, :invalid]))
      expect(cast("multiple_choice", ["aaaaaaa1", "bbbbbbb2"], **extra)).to(eq([["aaaaaaa1", "bbbbbbb2"], nil]))
      expect(cast("multiple_choice", ["aaaaaaa1", "aaaaaaa1"], **extra)).to(eq([nil, :invalid]))
      expect(cast("multiple_choice", ["aaaaaaa1", "zzzzzzz9"], **extra)).to(eq([nil, :invalid]))
      expect(cast("multiple_choice", "aaaaaaa1", **extra)).to(eq([nil, :invalid]))
      expect(cast("multiple_choice", ["aaaaaaa1", "bbbbbbb2"], max_choices: 1, **extra)).to(eq([nil, :too_many]))
    end

    it "validates ratings against the scale" do
      expect(cast("rating", 5, scale: 5)).to(eq([5, nil]))
      expect(cast("rating", 1, scale: 5)).to(eq([1, nil]))
      expect(cast("rating", 0, scale: 5)).to(eq([nil, :out_of_range]))
      expect(cast("rating", 6, scale: 5)).to(eq([nil, :out_of_range]))
      expect(cast("rating", 10, scale: 10)).to(eq([10, nil]))
      expect(cast("rating", 5.5, scale: 10)).to(eq([nil, :invalid]))
      expect(cast("rating", "5", scale: 5)).to(eq([nil, :invalid]))
    end

    it "validates dates" do
      expect(cast("date", "2026-10-04")).to(eq(["2026-10-04", nil]))
      expect(cast("date", "1900-01-01").last).to(be_nil)
      expect(cast("date", "2100-12-31").last).to(be_nil)
      expect(cast("date", "2026-02-30")).to(eq([nil, :invalid]))
      expect(cast("date", "99999-01-01")).to(eq([nil, :invalid]))
      expect(cast("date", "1899-12-31")).to(eq([nil, :out_of_range]))
      expect(cast("date", "2101-01-01")).to(eq([nil, :out_of_range]))
      expect(cast("date", "04/10/2026")).to(eq([nil, :invalid]))
      expect(cast("date", 20_261_004)).to(eq([nil, :invalid]))
    end

    it "rejects a field with an unknown type" do
      expect(described_class.cast_answer({ "id" => "abcd1234", "type" => "file", "label" => "x" }, "a")).to(eq([nil, :invalid]))
    end
  end
end
