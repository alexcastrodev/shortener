module Mcp
  module Tools
    class ApplyPageTemplate < Mcp::BaseTool
      tool_name "apply_page_template"
      title "Apply a template to a bio page draft"
      description "Replaces ALL links and the theme of an unpublished page with a built-in or own template."
      input_schema(properties: { page_id: { type: "integer", minimum: 1 }, template: { type: "string", maxLength: 40 } }, required: ["page_id", "template"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: true, open_world_hint: false)
      requires "pages:write", writes: true

      def self.perform(user:, page_id:, template:)
        page = Mcp::Guards.draft_page(user, page_id)
        data = PageToolHelpers.find_template(user, template)
        ::ApplyPageTemplate.call(page: page, theme: data["theme"], items: data["items"])
        PageToolHelpers.page_json(page.reload, links: true)
      end
    end
  end
end
