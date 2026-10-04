class FormFieldContract < ApplicationContract
  params do
    required(:type).filled(:string)
    required(:label).filled(:string)
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
  end
end
