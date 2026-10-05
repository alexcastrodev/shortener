module Mcp
  module Guards
    extend self

    def page(user, id)
      user.pages.find(id)
    end

    def draft_page(user, id)
      page = page(user, id)
      raise Mcp::ToolError.new("page_published", "This page is published: edit it in the dashboard") if page.published && !full?

      page
    end

    def full?
      Mcp::Current.full == true
    end

    def confirm!(expected, given, label)
      return if expected.to_s.strip.present? && expected.to_s.strip == given.to_s.strip

      raise Mcp::ToolError.new("confirmation_mismatch", "To confirm, repeat the exact #{label} of the item you mean to delete")
    end

    def form(user, id)
      user.forms.find(id)
    end

    def draft_form(user, id)
      form = form(user, id)
      raise Mcp::ToolError.new("form_published", "This form is published: edit it in the dashboard") if form.published && !full?

      form
    end

    STYLE_KEYS = [:theme, :custom_colors].freeze

    def editable_page(user, id, keys)
      page = page(user, id)
      raise Mcp::ToolError.new("page_published", "This page is published: only its theme and colors can be changed here, edit the rest in the dashboard or unpublish it first") if page.published && !full? && (keys.map(&:to_sym) - STYLE_KEYS).any?

      page
    end

    def editable_form(user, id, keys)
      form = form(user, id)
      raise Mcp::ToolError.new("form_published", "This form is published: only its theme and colors can be changed here, edit the rest in the dashboard or unpublish it first") if form.published && !full? && (keys.map(&:to_sym) - STYLE_KEYS).any?

      form
    end

    def structural_form(user, id)
      form = draft_form(user, id)
      raise Mcp::ToolError.new("form_has_responses", "This form already has responses: duplicate it in the dashboard to change its questions") if form.responses_count.positive? && !full?

      form
    end

    def contract!(contract_class, attributes)
      result = contract_class.new.call(attributes.reject { |key, value| value.nil? && key.to_sym != :custom_colors })
      raise Mcp::ToolError.new("invalid_input", result.errors.to_h.map { |key, messages| "#{key} #{Array(messages).join(", ")}" }.join("; ")) if result.errors.any?

      result.to_h
    end

    def saved!(record)
      raise Mcp::ToolError.new("invalid_input", record.errors.full_messages.to_sentence) unless record.save
    end
  end
end
