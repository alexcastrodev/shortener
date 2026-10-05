class GenerateTimesContract < ApplicationContract
  params do
    required(:from).filled(:string)
    required(:to).filled(:string)
    required(:step).filled(:integer)
    optional(:duration).filled(:integer)
    optional(:lunch).hash do
      required(:from).filled(:string)
      required(:to).filled(:string)
    end
    optional(:blocks).array(:hash) do
      required(:from).filled(:string)
      required(:to).filled(:string)
    end
  end
end
