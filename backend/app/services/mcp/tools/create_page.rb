module Mcp
  module Tools
    class CreatePage < Mcp::BaseTool
      tool_name "create_page"
      title "Create a bio page draft"
      description "Creates an unpublished bio page, optionally from a built-in or own template. It is never published by this tool."
      input_schema(
        properties: {
          slug: { type: "string", maxLength: 30 },
          display_title: { type: "string", maxLength: 80 },
          bio: { type: "string", maxLength: 300 },
          theme: { type: "string", enum: Page::THEMES },
          template: { type: "string", maxLength: 40 },
        },
        required: ["slug"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: false, open_world_hint: false)
      requires "pages:write", writes: true, limits: [[10, 1.hour], [50, 1.day]]

      def self.perform(user:, slug:, display_title: nil, bio: nil, theme: nil, template: nil)
        attributes = Mcp::Guards.contract!(PageContract, { slug: slug, display_title: display_title, bio: bio, theme: theme })
        template_data = PageToolHelpers.find_template(user, template) if template.present?
        page = user.pages.new(attributes.merge(published: false))
        Page.transaction do
          Mcp::Guards.saved!(page)
          ::ApplyPageTemplate.call(page: page, theme: template_data["theme"], items: template_data["items"]) if template_data
        end
        PageToolHelpers.with_note(PageToolHelpers.page_json(page.reload, links: true))
      end
    end
  end
end
