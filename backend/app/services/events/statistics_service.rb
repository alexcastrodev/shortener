# frozen_string_literal: true

module Events
  class StatisticsService
    include Callable

    def initialize(user:)
      @user = user
    end

    def call
      return unless valid?

      @event_stats ||= fetch_event_statistics
      @device_stats ||= fetch_device_statistics

      {
        browser_statistics: format_browser_statistics,
        country_statistics: format_country_statistics,
        device_statistics: format_device_statistics,
        region_statistics: format_region_statistics,
      }
    end

    def valid?
      user.present?
    end

    private

    attr_reader :user

    def fetch_event_statistics
      sql = <<~SQL
        SELECT country_code, region, browser, COUNT(*) AS count
        FROM events
        JOIN shortlinks ON events.shortlink_id = shortlinks.id
        WHERE shortlinks.user_id = ?
        GROUP BY country_code, region, browser
        ORDER BY count DESC
      SQL

      execute_query(sql)
    end

    def fetch_device_statistics
      sql = <<~SQL
        SELECT platform, COUNT(*) AS count
        FROM events
        JOIN shortlinks ON events.shortlink_id = shortlinks.id
        WHERE shortlinks.user_id = ?
        GROUP BY platform
        ORDER BY count DESC
      SQL

      execute_query(sql)
    end

    def format_device_statistics
      @device_stats.map do |item|
        {
          name: item["platform"],
          value: item["count"],
        }
      end
    end

    def format_browser_statistics
      browser_data = @event_stats.each_with_object(Hash.new(0)) do |item, hash|
        browser = item["browser"].presence || "Unknown"
        hash[browser] += item["count"]
      end

      browser_data.map do |browser, count|
        {
          name: browser,
          value: count,
        }
      end
    end

    def format_country_statistics
      country_data = @event_stats.each_with_object(Hash.new(0)) do |item, hash|
        country = item["country_code"].presence || "Unknown"
        hash[country] += item["count"]
      end

      country_data.map do |country, count|
        {
          country: country,
          count: count,
          color: "violet.6",
        }
      end
    end

    def format_region_statistics
      region_data = @event_stats.each_with_object(Hash.new(0)) do |item, hash|
        region = item["region"].presence || "Unknown"
        hash[region] += item["count"]
      end

      region_data.map do |region, count|
        {
          region: region,
          count: count,
          color: "teal.6",
        }
      end
    end

    def execute_query(sql)
      ActiveRecord::Base.connection.exec_query(
        ActiveRecord::Base.sanitize_sql_array([sql, user.id]),
      ).to_a
    end
  end
end
