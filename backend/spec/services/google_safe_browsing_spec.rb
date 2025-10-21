# frozen_string_literal: true

require "rails_helper"

RSpec.describe(GoogleLib::SafeBrowsing::V4::Services, vcr: true, google: true) do
  let(:invalid_url) { "https://testsafebrowsing.appspot.com/s/malware.html" }
  let(:valid_url) { "https://kurz.fyi" }

  context "when API returns matches" do
    it "returns true" do
      expect(described_class.check_url(valid_url)).to(be(true))
    end
  end

  context "when API returns no matches" do
    it "returns false" do
      expect(described_class.check_url(invalid_url)).to(be(false))
    end
  end
end
