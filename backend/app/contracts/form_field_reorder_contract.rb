class FormFieldReorderContract < ApplicationContract
  params do
    required(:ids).array(:string)
  end
end
