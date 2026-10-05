module Forms
  class TrackEvent
    include Callable

    EVENTS = ["view", "start"].freeze
    UNIQUE_TTL = 25.hours

    def initialize(form:, event:, ip:, user_agent:, now: Time.current)
      @form = form
      @event = event.to_s
      @ip = ip.to_s
      @user_agent = user_agent.to_s
      @day = now.utc.to_date
    end

    def call
      return false unless EVENTS.include?(event)

      FormDailyStat.upsert_all(
        [{ form_id: form.id, day: day, views: views, unique_views: unique_views, starts: starts }],
        unique_by: [:form_id, :day],
        on_duplicate: Arel.sql(
          "views = form_daily_stats.views + EXCLUDED.views, " \
            "unique_views = form_daily_stats.unique_views + EXCLUDED.unique_views, " \
            "starts = form_daily_stats.starts + EXCLUDED.starts",
        ),
      )
      true
    end

    private

    attr_reader :form, :event, :ip, :user_agent, :day

    def views
      event == "view" ? 1 : 0
    end

    def starts
      event == "start" ? 1 : 0
    end

    def unique_views
      event == "view" && first_visit_today? ? 1 : 0
    end

    def first_visit_today?
      Rails.cache.write("fv:#{form.id}:#{day}:#{visitor_digest}", 1, expires_in: UNIQUE_TTL, unless_exist: true) == true
    end

    def visitor_digest
      daily_key = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "form-visitor:#{day}")
      OpenSSL::HMAC.hexdigest("SHA256", daily_key, "#{form.id}|#{ip}|#{user_agent}").first(32)
    end
  end
end
