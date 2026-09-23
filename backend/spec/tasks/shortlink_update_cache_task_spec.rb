require "rails_helper"
require "rake"

RSpec.describe("shortlink:update_cache", type: :task) do
  before(:all) do
    Rails.application.load_tasks
  end

  before do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?
    Rake::Task["shortlink:update_cache"].reenable
  end

  def redis(&block)
    Rails.cache.redis.with(&block)
  end

  it "migrates legacy raw URLs to JSON, drops dead links and keeps other keys" do
    live = FactoryBot.create(:shortlink, original_url: "https://live.example.com")
    dead = FactoryBot.create(:shortlink)
    dead.update_columns(inactive_at: Time.current)
    redis do |conn|
      conn.set(live.cache_key, "https://live.example.com")
      conn.set(dead.cache_key, "https://dead.example.com")
      conn.set("unrelated", "keep me")
    end

    Rake::Task["shortlink:update_cache"].invoke

    redis do |conn|
      expect(JSON.parse(conn.get(live.cache_key))).to(eq({ "t" => "url", "v" => "https://live.example.com" }))
      expect(conn.get(dead.cache_key)).to(be_nil)
      expect(conn.get("unrelated")).to(eq("keep me"))
    end
  end
end
