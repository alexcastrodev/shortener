module Forms
  module Snapshot
    extend self

    KEYS = ["title", "description", "thank_you_message", "theme", "custom_colors", "layout", "fields"].freeze

    def of(form)
      JSON.parse(form.slice(*KEYS).to_json)
    end

    def changed?(form)
      form.published_snapshot.present? && form.published_snapshot != of(form)
    end
  end
end
