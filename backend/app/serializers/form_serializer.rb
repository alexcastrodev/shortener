class FormSerializer < BaseSerializer
  with_id
  with_timestamps
  root_key_for_collection :form

  attributes :public_id, :title, :description, :thank_you_message, :theme, :published, :fields, :responses_count, :public_url
end
