# frozen_string_literal: true

# Clicks on a bio page's links (buttons and social icons) over a period:
# totals, a per-day series, the most clicked links and who clicked (source,
# device, browser, country). Days are UTC.
module Pages
  class StatisticsService
    include Callable

    PERIODS = [7, 30, 90].freeze
    DEFAULT_PERIOD = 30
    TOP = 8

    def initialize(page:, days: DEFAULT_PERIOD)
      @page = page
      @days = PERIODS.include?(days.to_i) ? days.to_i : DEFAULT_PERIOD
    end

    def call
      {
        period_days: days,
        total_clicks: page.page_links.sum(:clicks_count),
        period_clicks: clicks.count,
        timeline: timeline,
        links: links,
        sources: sources,
        devices: count_by(:platform),
        browsers: browsers,
        countries: count_by(:country_code),
      }
    end

    private

    attr_reader :page, :days

    def since
      @since ||= (days - 1).days.ago.utc.beginning_of_day
    end

    def clicks
      PageLinkClick.joins(:page_link).where(page_links: { page_id: page.id }).where(clicked_at: since..)
    end

    # Every day in the period, including the ones without clicks.
    def timeline
      counts = clicks.group(Arel.sql("DATE(page_link_clicks.clicked_at AT TIME ZONE 'UTC')")).count
        .transform_keys(&:to_date)

      (since.to_date..Time.current.utc.to_date).map { |day| { date: day.iso8601, clicks: counts.fetch(day, 0) } }
    end

    def links
      counts = clicks.group(:page_link_id).count

      page.page_links.where.not(kind: "header").map do |link|
        {
          id: link.id,
          kind: link.kind,
          label: link.label,
          icon: link.icon,
          active: link.active,
          clicks: counts.fetch(link.id, 0),
          total_clicks: link.clicks_count,
        }
      end.sort_by { |link| [-link[:clicks], -link[:total_clicks]] }
    end

    def sources
      totals = Hash.new(0)
      clicks.group(:user_agent, :referer).count.each do |(user_agent, referer), count|
        totals[TrafficSource.call(user_agent: user_agent, referer: referer)] += count
      end
      ranked(totals)
    end

    # In-app browsers (most bio page traffic) do not call themselves Safari
    # or Chrome, so they would all be "Unknown"; name them after the app.
    def browsers
      totals = Hash.new(0)
      clicks.group(:browser, :user_agent).count.each do |(browser, user_agent), count|
        app = TrafficSource.in_app(user_agent)
        totals[app ? "#{app} app" : browser.presence || "Unknown"] += count
      end
      ranked(totals)
    end

    def count_by(column)
      totals = clicks.group(column).count.transform_keys { |key| key.presence || "Unknown" }
      ranked(totals)
    end

    # Largest first; the long tail folds into "Other".
    def ranked(totals)
      sorted = totals.sort_by { |name, count| [-count, name] }
      top = sorted.first(TOP).map { |name, count| { name: name, clicks: count } }
      rest = sorted.drop(TOP).sum { |_, count| count }
      rest.positive? ? top << { name: "Other", clicks: rest } : top
    end
  end
end
