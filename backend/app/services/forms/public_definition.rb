module Forms
  PublicDefinition = Data.define(:title, :description, :thank_you_message, :theme, :custom_colors, :layout, :fields, :published_version) do
    def self.for(form)
      source = Snapshot.enabled? && form.published_snapshot.present? ? form.published_snapshot : Snapshot.of(form)
      new(**source.symbolize_keys.slice(*Snapshot::KEYS.map(&:to_sym)), published_version: form.published_version)
    end
  end
end
