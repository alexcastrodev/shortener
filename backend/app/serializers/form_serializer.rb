class FormSerializer < BaseSerializer
  with_id
  with_timestamps
  root_key_for_collection :form

  attributes :public_id, :title, :description, :thank_you_message, :theme, :custom_colors, :layout, :published, :fields, :responses_count, :public_url, :shortlink_id, :published_version

  attribute :has_unpublished_changes do |form|
    Forms::Snapshot.changed?(form)
  end

  attribute :short_url do |form|
    form.shortlink&.short_url
  end
end
