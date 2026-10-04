require "rails_helper"

RSpec.describe("eager loading") do
  it "loads every constant the way production does" do
    expect { Zeitwerk::Loader.eager_load_all }.not_to(raise_error)
  end
end
