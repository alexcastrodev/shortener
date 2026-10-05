module Mcp
  module Tools
    module ResponseToolHelpers
      TEXT_TYPES = ["short_text", "long_text", "email"].freeze

      def self.response_json(form, response, budget)
        answers = form.fields.filter_map do |field|
          next unless response.answers.key?(field["id"])

          { question: Content.clean(field["label"], max: 300), type: field["type"], value: value_for(field, response.answers[field["id"]], budget) }
        end
        { id: response.id, submitted_at: response.created_at.iso8601, answers: answers }
      end

      def self.value_for(field, raw, budget)
        case field["type"]
        when *TEXT_TYPES then Untrusted.text(raw, budget)
        when "single_choice" then choice_label(field, raw)
        when "multiple_choice" then Array(raw).map { |id| choice_label(field, id) }
        when "date" then Content.clean(raw, max: 10)
        else raw
        end
      end

      def self.choice_label(field, id)
        label = field["choices"].find { |choice| choice["id"] == id }&.fetch("label")
        label ? Content.clean(label, max: Forms::FieldSchema::CHOICE_LABEL_MAX) : "(removed option)"
      end

      def self.allowance!(user, wanted)
        left = ResponseBudget.remaining(user)
        raise Mcp::ToolError.new("response_budget_exhausted", "Daily limit of responses read through connected apps reached") if left.zero?

        [wanted, left].min
      end

      def self.page(user, form, rows)
        budget = Untrusted.budget(Untrusted::PAGE_MAX)
        rows.map do |row|
          response_budget = { response: Untrusted::RESPONSE_MAX, page: budget[:page] }
          json = response_json(form, row, response_budget)
          budget[:page] = response_budget[:page]
          json
        end
      end
    end
  end
end
