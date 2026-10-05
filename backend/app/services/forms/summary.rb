module Forms
  class Summary
    include Callable

    PERIODS = [7, 30, 90].freeze
    DEFAULT_PERIOD = 30
    TOP = 8
    SAMPLES = 5
    SAMPLE_CHARS = 200
    BATCH = 1000

    def initialize(form:, days: DEFAULT_PERIOD, text_samples: true)
      @form = form
      @all = days.to_s == "all"
      @days = PERIODS.include?(days.to_i) ? days.to_i : DEFAULT_PERIOD
      @text_samples = text_samples
    end

    def call
      {
        period_days: all ? "all" : days,
        funnel: funnel,
        timeline: timeline,
        audience: {
          sources: ranked(responses.group(:source).count),
          devices: ranked(responses.group(:platform).count),
          browsers: ranked(responses.group(:browser).count),
          countries: ranked(responses.group(:country).count),
        },
        fields: fields,
      }
    end

    private

    attr_reader :form, :days, :all, :text_samples

    def since
      @since ||= all ? nil : (days - 1).days.ago.utc.beginning_of_day
    end

    def responses
      scope = form.responses
      since ? scope.where(created_at: since..) : scope
    end

    def stats
      scope = form.daily_stats
      since ? scope.where(day: since.to_date..) : scope
    end

    def funnel
      views = stats.sum(:views)
      completions = responses.count
      {
        views: views,
        unique_views: stats.sum(:unique_views),
        starts: stats.sum(:starts),
        completions: completions,
        completion_rate: views.positive? ? (completions.to_f / views).round(3) : nil,
      }
    end

    def timeline
      first = since&.to_date || form.created_at.utc.to_date
      views = stats.pluck(:day, :views).to_h
      done = responses.group(Arel.sql("DATE(form_responses.created_at AT TIME ZONE 'UTC')")).count.transform_keys(&:to_date)

      (first..Time.current.utc.to_date).map do |day|
        { date: day.iso8601, views: views.fetch(day, 0), responses: done.fetch(day, 0) }
      end
    end

    def fields
      form.fields.map { |field| field_summary(field) }
    end

    def field_summary(field)
      base = { id: field["id"], type: field["type"], label: field["label"] }
      values = answers_for(field["id"])
      base.merge(answered: values.size).merge(detail(field, values))
    end

    def answers_for(field_id)
      values = []
      responses.in_batches(of: BATCH) do |batch|
        batch.pluck(Arel.sql("answers -> #{ActiveRecord::Base.connection.quote(field_id)}")).each do |value|
          values << value unless value.nil?
        end
      end
      values
    end

    def detail(field, values)
      case field["type"]
      when "short_text", "long_text", "email" then text_detail(values)
      when "number" then number_detail(values)
      when "single_choice", "multiple_choice" then choice_detail(field, values.flatten)
      when "yes_no" then { yes: values.count(true), no: values.count(false) }
      when "rating" then rating_detail(field, values)
      when "date" then { first: values.min, last: values.max }
      else {}
      end
    end

    def text_detail(values)
      return {} unless text_samples

      { samples: values.last(SAMPLES).reverse.map { |value| value.to_s.first(SAMPLE_CHARS) } }
    end

    def number_detail(values)
      return {} if values.empty?

      { min: values.min, max: values.max, average: (values.sum.to_f / values.size).round(2) }
    end

    def choice_detail(field, picked)
      counts = picked.tally
      known = field["choices"].map { |choice| { id: choice["id"], label: choice["label"], count: counts.delete(choice["id"]) || 0 } }
      removed = counts.values.sum
      { choices: removed.positive? ? known << { id: nil, label: "removed", count: removed } : known }
    end

    def rating_detail(field, values)
      distribution = (1..field["scale"].to_i).map { |point| { rating: point, count: values.count(point) } }
      { average: values.empty? ? nil : (values.sum.to_f / values.size).round(2), distribution: distribution }
    end

    def ranked(totals)
      totals = totals.transform_keys { |key| key.presence || "Unknown" }
      sorted = totals.sort_by { |name, count| [-count, name] }
      top = sorted.first(TOP).map { |name, count| { name: name, count: count } }
      rest = sorted.drop(TOP).sum { |_, count| count }
      rest.positive? ? top << { name: "Other", count: rest } : top
    end
  end
end
