# frozen_string_literal: true

require "rails_helper"

RSpec.describe(GoogleLib::SafeBrowsing::Services) do
  let(:invalid_url) { "https://testsafebrowsing.appspot.com/s/malware.html" }
  let(:valid_url) { "https://kurz.fyi" }

  context "when API returns matches" do
    it "returns true" do
      expect(described_class.check_url(valid_url)).to(be(true))
    end
  end

  context "when API returns no matches", focus: true do
    it "returns false" do
      expect(described_class.check_url(invalid_url)).to(be(false))
    end
  end

  context "when url is missing" do
    it "raises ArgumentError" do
      expect { described_class.check_url(nil) }.to(raise_error(ArgumentError))
    end
  end
end
