module Mcp
  module Tools
    module PageToolHelpers
      LINK_FIELDS = {
        kind: { type: "string", enum: PageLink::KINDS },
        label: { type: "string", maxLength: 80 },
        url: { type: "string", maxLength: 2048 },
        icon: { type: "string", enum: PageLink::ICONS },
      }.freeze

      def self.page_json(page, links: false)
        json = {
          id: page.id,
          slug: page.slug,
          display_title: page.display_title && Mcp::Content.clean(page.display_title, max: 80),
          bio: page.bio && Mcp::Content.clean(page.bio, max: 300),
          theme: page.theme,
          published: page.published,
          public_url: page.public_url,
          dashboard_url: "#{ENV.fetch("FRONTEND_URL", "https://kurz.fyi")}/app/pages/#{page.id}",
        }
        json[:links] = page.page_links.map { |link| link_json(link) } if links
        json
      end

      def self.link_json(link)
        {
          id: link.id,
          kind: link.kind,
          label: Mcp::Content.clean(link.label, max: 80),
          url: link.url && Mcp::Content.clean(link.url, max: 2048),
          icon: link.icon,
          active: link.active,
          position: link.position,
        }
      end

      def self.find_template(user, id)
        id = id.to_s
        raise Mcp::ToolError.new("invalid_input", "Unknown template") if id.start_with?("community-")

        if id.start_with?("custom-")
          template = user.page_templates.find(id.delete_prefix("custom-"))
          { "theme" => template.theme, "items" => template.items }
        else
          BuiltInPageTemplates.find(id) || raise(Mcp::ToolError.new("invalid_input", "Unknown template"))
        end
      end

      def self.with_note(json)
        json.merge(note: "Draft: it is not public. Publish it from the dashboard.")
      end
    end
  end
end
