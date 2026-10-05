class FormFieldUpdateContract < ApplicationContract
  params do
    optional(:type).filled(:string)
    optional(:label).filled(:string)
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
    optional(:services).array(:hash) do
      optional(:id).filled(:string)
      required(:name).filled(:string)
      required(:duration).filled(:integer)
      optional(:price).maybe(:float)
      optional(:currency).maybe(:string)
      optional(:capacity).maybe(:integer)
      required(:days).array(:string)
      required(:times).array(:string)
    end
    optional(:rules).hash do
      optional(:time_zone).filled(:string)
      optional(:approval).filled(:string)
    end
  end
end
