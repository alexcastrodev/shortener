module Forms
  PublicDefinition = Data.define(:title, :description, :thank_you_message, :theme, :custom_colors, :layout, :fields) do
    def self.for(form)
      new(
        title: form.title,
        description: form.description,
        thank_you_message: form.thank_you_message,
        theme: form.theme,
        custom_colors: form.custom_colors,
        layout: form.layout,
        fields: form.fields,
      )
    end
  end
end
