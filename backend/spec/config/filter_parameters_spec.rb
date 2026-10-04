require "rails_helper"

RSpec.describe "filter_parameters" do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  %w[code code_verifier credential answers answer value values text message comment
     arguments query q search filename file refresh_token client_secret].each do |key|
    it "filters #{key}" do
      expect(filter.filter(key => "CNRY-secret")[key]).to eq("[FILTERED]")
    end
  end

  it "filters nested answers" do
    expect(filter.filter("form_response" => { "answers" => { "f1" => "x" } })["form_response"]["answers"]).to eq("[FILTERED]")
  end
end
