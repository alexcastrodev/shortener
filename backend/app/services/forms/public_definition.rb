module Forms
  PublicDefinition = Data.define(:title, :description, :thank_you_message, :theme, :custom_colors, :layout, :fields, :cover_token, :cover_position, :intro_enabled, :start_label, :published_version) do
    def initialize(cover_token: nil, cover_position: 50, intro_enabled: false, start_label: nil, **rest)
      super
    end

    def self.for(form)
      source = form.published_snapshot.present? ? Snapshot.stored(form) : Snapshot.of(form)
      attributes = source.symbolize_keys.slice(*Snapshot::KEYS.map(&:to_sym))
      attributes[:fields] = attributes[:fields].map { |field| Booking::Modes.compile(field) }
      new(**attributes, published_version: form.published_version)
    end
  end
end
