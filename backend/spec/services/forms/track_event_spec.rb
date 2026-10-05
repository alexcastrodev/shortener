require "rails_helper"

RSpec.describe(Forms::TrackEvent) do
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Survey", published: true) }
  let(:now) { Time.utc(2026, 10, 5, 12, 0, 0) }

  def track(event, ip: "198.51.100.1", user_agent: "Mozilla/5.0", form: self.form, at: now)
    described_class.call(form: form, event: event, ip: ip, user_agent: user_agent, now: at)
  end

  def stat(day = now.to_date)
    FormDailyStat.find_by(form_id: form.id, day: day)
  end

  it "counts views and starts per form and UTC day" do
    track("view")
    track("view", ip: "198.51.100.2")
    track("start")

    expect(stat).to(have_attributes(views: 2, starts: 1))
  end

  it "counts a visitor once as unique per day, however many views" do
    3.times { track("view") }
    track("view", ip: "198.51.100.2")
    track("view", ip: "198.51.100.1", user_agent: "Other/1.0")

    expect(stat).to(have_attributes(views: 5, unique_views: 3))
  end

  it "counts the same visitor again on the next UTC day" do
    track("view")
    track("view", at: now + 1.day)

    expect(stat).to(have_attributes(views: 1, unique_views: 1))
    expect(stat(now.to_date + 1)).to(have_attributes(views: 1, unique_views: 1))
  end

  it "does not link a visitor across forms" do
    other = Form.create!(user: form.user, title: "Other", published: true)
    track("view")
    track("view", form: other)

    expect(stat.unique_views).to(eq(1))
    expect(FormDailyStat.find_by(form_id: other.id, day: now.to_date).unique_views).to(eq(1))
  end

  it "only counts uniqueness on views" do
    track("start")
    track("start")

    expect(stat).to(have_attributes(views: 0, unique_views: 0, starts: 2))
  end

  it "ignores unknown events and answers false" do
    ["", nil, "click", "VIEW", "view; drop table", ["view"]].each do |bad|
      expect(track(bad)).to(be(false))
    end
    expect(FormDailyStat.count).to(eq(0))
  end

  it "stores no visitor data in the database" do
    track("view", ip: "203.0.113.77", user_agent: "CNRY-agent")

    expect(FormDailyStat.column_names).to(match_array(["id", "form_id", "day", "views", "unique_views", "starts"]))
    expect(stat.attributes.values.join(" ")).not_to(include("203.0.113.77"))
  end

  it "keeps the unique key free of the IP and user agent" do
    track("view", ip: "203.0.113.77", user_agent: "CNRY-agent")
    keys = []
    allow(Rails.cache).to(receive(:write).and_wrap_original do |original, key, *args, **options|
      keys << key
      original.call(key, *args, **options)
    end)

    track("view", ip: "203.0.113.78", user_agent: "CNRY-agent")

    expect(keys.size).to(eq(1))
    expect(keys.first).to(match(/\Afv:#{form.id}:2026-10-05:[0-9a-f]{32}\z/))
  end

  it "loses no count when many events arrive at once" do
    form
    threads = Array.new(20) do |i|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          described_class.call(form: Form.find(form.id), event: "view", ip: "198.51.100.#{i % 5}", user_agent: "Mozilla", now: now)
        end
      end
    end
    threads.each(&:join)

    expect(stat).to(have_attributes(views: 20, unique_views: 5))
  end
end
