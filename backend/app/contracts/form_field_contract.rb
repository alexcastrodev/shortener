class FormFieldContract < ApplicationContract
  params do
    required(:type).filled(:string)
    optional(:label).maybe(:string)
    optional(:help).maybe(:string)
    optional(:required).filled(:bool)
    optional(:scale).filled(:integer)
    optional(:min).maybe(:float)
    optional(:max).maybe(:float)
    optional(:max_choices).maybe(:integer)
    optional(:choices).array(:hash) do
      required(:label).filled(:string)
      optional(:id).filled(:string)
    end
    optional(:categories).array(:hash) do
      optional(:id).filled(:string)
      required(:name).filled(:string)
    end
    optional(:mode).filled(:string)
    optional(:availability).hash do
      optional(:days).array(:string)
      optional(:times).array(:string)
      optional(:times_by_day).hash do
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].each { |day| optional(day.to_sym).array(:string) }
      end
    end
    optional(:services).array(:hash) do
      optional(:id).filled(:string)
      optional(:category_id).maybe(:string)
      required(:name).filled(:string)
      required(:duration).filled(:integer)
      optional(:price).maybe(:float)
      optional(:currency).maybe(:string)
      optional(:capacity).maybe(:integer)
      optional(:days).array(:string)
      optional(:times).array(:string)
      optional(:extra_durations).array(:hash) do
        required(:duration).filled(:integer)
        optional(:price).maybe(:float)
      end
      optional(:monthly).maybe(:hash) do
        optional(:price).maybe(:float)
        optional(:duration).maybe(:integer)
        optional(:sessions).maybe(:integer)
        optional(:per).maybe(:string)
      end
      optional(:times_by_day).hash do
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].each { |day| optional(day.to_sym).array(:string) }
      end
    end
    optional(:exceptions).array(:hash) do
      optional(:id).filled(:string)
      required(:from).filled(:string)
      optional(:to).maybe(:string)
      required(:kind).filled(:string)
      optional(:times).array(:string)
      optional(:service_ids).array(:string)
      optional(:note).maybe(:string)
    end
    optional(:rules).hash do
      optional(:time_zone).filled(:string)
      optional(:approval).filled(:string)
      optional(:approval_timeout_minutes).maybe(:integer)
      optional(:approval_on_timeout).filled(:string)
      optional(:approval_within_minutes).maybe(:integer)
      optional(:reminder_minutes).array(:integer)
      optional(:verify_email).maybe(:bool)
      optional(:waitlist).maybe(:bool)
      optional(:waitlist_confirm_minutes).maybe(:integer)
      optional(:multiple_services).maybe(:bool)
      optional(:min_notice_minutes).maybe(:integer)
      optional(:window_days).maybe(:integer)
      optional(:buffer_minutes).maybe(:integer)
      optional(:max_per_day).maybe(:integer)
    end
  end
end
