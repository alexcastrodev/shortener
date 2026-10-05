require "rails_helper"

RSpec.describe("request log", type: :request) do
  it "never writes the visitor IP" do
    io = StringIO.new
    previous = Rails.logger
    Rails.logger = ActiveSupport::TaggedLogging.new(Logger.new(io))
    host! "localhost"
    get "/up", headers: { "X-Forwarded-For" => "203.0.113.77", "CF-Connecting-IP" => "203.0.113.77" }
    Rails.logger = previous

    expect(io.string).to(include("Started GET"))
    expect(io.string).not_to(include("203.0.113.77"))
  end
end
