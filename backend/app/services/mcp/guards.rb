module Mcp
  module Guards
    extend self

    def page(user, id)
      user.pages.find(id)
    end

    def draft_page(user, id)
      page = page(user, id)
      raise Mcp::ToolError.new("page_published", "This page is published: edit it in the dashboard") if page.published

      page
    end

    def contract!(contract_class, attributes)
      result = contract_class.new.call(attributes.compact)
      raise Mcp::ToolError.new("invalid_input", result.errors.to_h.map { |key, messages| "#{key} #{Array(messages).join(", ")}" }.join("; ")) if result.errors.any?

      result.to_h
    end

    def saved!(record)
      raise Mcp::ToolError.new("invalid_input", record.errors.full_messages.to_sentence) unless record.save
    end
  end
end
