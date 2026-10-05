module Appointments
  module GenerateTimes
    extend self

    PRESET_STEPS = [30, 60, 90, 120].freeze
    CUSTOM_STEP = (5..600)
    TIME = /\A([01]\d|2[0-3]):[0-5]\d\z/

    Result = Struct.new(:times, :warnings, :errors, :generator, keyword_init: true)

    def call(from:, to:, step:, duration: 60, lunch: nil, blocks: [])
      generator = { from: from, to: to, step: step, lunch: lunch, blocks: blocks }
      errors = validate(generator, duration)
      return Result.new(times: [], warnings: [], errors: errors, generator: generator) if errors.any?

      off = [lunch, *blocks].compact.map { |range| [minutes(range[:from]), minutes(range[:to])] }
      first = minutes(from)
      last = minutes(to)
      times = []
      cursor = first
      while cursor + duration <= last
        times << format_time(cursor) unless off.any? { |start, finish| cursor < finish && cursor + duration > start }
        cursor += step
      end

      warnings = []
      warnings << "overlapping_sessions" if duration > step
      errors << "no_times" if times.empty?
      Result.new(times: times, warnings: warnings, errors: errors, generator: generator)
    end

    private

    def validate(generator, duration)
      ranges = [generator[:lunch], *generator[:blocks]].compact
      times = [generator[:from], generator[:to], *ranges.flat_map { |range| [range[:from], range[:to]] }]
      errors = []
      errors << "invalid_time" unless times.all? { |value| TIME.match?(value.to_s) }
      errors << "invalid_step" unless PRESET_STEPS.include?(generator[:step]) || CUSTOM_STEP.cover?(generator[:step])
      errors << "invalid_duration" unless duration.is_a?(Integer) && duration.positive?
      errors << "invalid_range" if errors.empty? && minutes(generator[:to]) <= minutes(generator[:from])
      errors
    end

    def minutes(value)
      hours, mins = value.split(":").map(&:to_i)
      hours * 60 + mins
    end

    def format_time(total)
      format("%02d:%02d", total / 60, total % 60)
    end
  end
end
