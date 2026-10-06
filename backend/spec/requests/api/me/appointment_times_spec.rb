require "rails_helper"

RSpec.describe("POST /api/me/appointments/generate_times", type: :request) do
  include_context "authenticated user"

  let(:json) { JSON.parse(response.body) }
  let(:base) { { from: "09:00", to: "18:00", step: 60 } }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
  end

  def generate(params)
    post("/api/me/appointments/generate_times", params: params, headers: auth_headers, as: :json)
  end

  describe "access" do
    it "answers 401 without a token" do
      post("/api/me/appointments/generate_times", params: base, as: :json)
      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "generation" do
    it "lists every hour of the working day" do
      generate(base)
      expect(response).to(have_http_status(:ok))
      expect(json["times"]).to(eq(["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]))
      expect(json["warnings"]).to(eq([]))
    end

    it "supports a half-hour step" do
      generate(base.merge(step: 30, duration: 30, to: "11:00"))
      expect(json["times"]).to(eq(["09:00", "09:30", "10:00", "10:30"]))
    end

    it "supports a custom step between 5 and 600 minutes" do
      generate(base.merge(step: 45, duration: 45, to: "11:15"))
      expect(json["times"]).to(eq(["09:00", "09:45", "10:30"]))
    end

    it "skips the lunch break" do
      generate(base.merge(lunch: { from: "12:00", to: "13:00" }))
      expect(json["times"]).to(eq(["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]))
    end

    it "drops any session that would run into the break" do
      generate(base.merge(lunch: { from: "12:30", to: "13:30" }))
      expect(json["times"]).not_to(include("12:00", "13:00"))
      expect(json["times"]).to(include("11:00", "14:00"))
    end

    it "skips unavailable ranges" do
      generate(base.merge(blocks: [{ from: "15:00", to: "16:00" }, { from: "09:00", to: "10:00" }]))
      expect(json["times"]).to(eq(["10:00", "11:00", "12:00", "13:00", "14:00", "16:00", "17:00"]))
    end

    it "only offers sessions that end within the working day" do
      generate(base.merge(to: "11:30", duration: 60))
      expect(json["times"]).to(eq(["09:00", "10:00"]))
    end

    it "warns when sessions are longer than the step and therefore overlap" do
      generate(base.merge(to: "12:00", duration: 90))
      expect(response).to(have_http_status(:ok))
      expect(json["times"]).to(eq(["09:00", "10:00"]))
      expect(json["warnings"]).to(eq(["overlapping_sessions"]))
    end

    it "returns the generator parameters so the editor can regenerate later" do
      generate(base.merge(lunch: { from: "12:00", to: "13:00" }, blocks: [{ from: "15:00", to: "16:00" }]))
      expect(json["generator"]).to(eq({
        "from" => "09:00",
        "to" => "18:00",
        "step" => 60,
        "lunch" => { "from" => "12:00", "to" => "13:00" },
        "blocks" => [{ "from" => "15:00", "to" => "16:00" }],
      }))
    end
  end

  describe "invalid input" do
    it "rejects a step outside 30, 60, 90, 120 and 5 to 600" do
      [4, 601, 0].each do |step|
        generate(base.merge(step: step))
        expect(response).to(have_http_status(:unprocessable_entity), "step #{step}")
      end
      generate(base.merge(step: 4))
      expect(json["errors"]).to(include("invalid_step"))
    end

    it "rejects an end that is not after the start" do
      generate(base.merge(from: "18:00", to: "09:00"))
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(eq(["invalid_range"]))
    end

    it "rejects malformed times" do
      generate(base.merge(from: "25:00"))
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(include("invalid_time"))
    end

    it "reports when the rules leave no time at all" do
      generate(base.merge(lunch: { from: "09:00", to: "18:00" }))
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(eq(["no_times"]))
      expect(json["times"]).to(eq([]))
    end

    it "rejects a missing field" do
      generate({ from: "09:00", to: "18:00" })
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(have_key("step"))
    end
  end
end
