module Forms
  module Definition
    extend self

    def add(form, attributes)
      attributes = BookingSchema.defaults(attributes, form.user) if attributes.stringify_keys["type"] == "booking"
      form.with_lock do
        form.fields = form.fields + [FieldSchema.with_new_ids(attributes.except(:id, "id"))]
        form.save!
      end
      form
    end

    def update(form, id, attributes)
      form.with_lock do
        field = find_field(form, id)
        attributes = attributes.stringify_keys
        reject(form, :fields, "type cannot be changed") if attributes["type"] && attributes["type"] != field["type"]

        attributes = attributes.merge("rules" => field["rules"].merge(attributes["rules"].stringify_keys)) if field["rules"].is_a?(Hash) && attributes["rules"].is_a?(Hash)
        changed = field.merge(attributes.except("type", "id")).compact
        form.fields = form.fields.map { |current| current["id"] == id ? FieldSchema.with_new_ids(changed) : current }
        form.save!
      end
      form
    end

    def remove(form, id)
      form.with_lock do
        find_field(form, id)
        form.fields = form.fields.reject { |field| field["id"] == id }
        form.save!
      end
      form
    end

    def reorder(form, ids)
      form.with_lock do
        current = form.fields.index_by { |field| field["id"] }
        reject(form, :ids, "must list every question exactly once") unless ids.uniq.size == ids.size && ids.sort == current.keys.sort
        form.fields = ids.map { |id| current[id] }
        form.save!
      end
      form
    end

    def apply_template(form, template_id, locale: nil)
      built = BuiltInFormTemplates.build(template_id, locale: locale)
      reject(form, :template, "is unknown") unless built

      form.with_lock do
        reject(form, :template, "cannot replace the questions of a form that has responses") if form.responses_count.positive?
        form.update!(built.slice("fields", "theme", "thank_you_message"))
      end
      form
    end

    private

    def find_field(form, id)
      form.fields.find { |field| field["id"] == id } || raise(ActiveRecord::RecordNotFound)
    end

    def reject(form, attribute, message)
      form.errors.add(attribute, message)
      raise ActiveRecord::RecordInvalid, form
    end
  end
end
