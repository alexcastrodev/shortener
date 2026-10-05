module Users
  class DataExport
    include Callable

    MAX_RESPONSES = 50_000
    class TooLarge < StandardError; end

    def initialize(user:)
      @user = user
    end

    def call
      raise TooLarge if responses_total > MAX_RESPONSES

      {
        exported_at: Time.current.iso8601,
        account: account,
        shortlinks: shortlinks,
        pages: pages,
        forms: forms,
        page_templates: page_templates,
        color_palettes: user.color_palettes.order(:id).map { |palette| { name: palette.name, custom_colors: palette.custom_colors, created_at: palette.created_at.iso8601 } },
        connected_apps: user.oauth_grants.includes(:oauth_client).order(:id).map { |grant| { client: grant.oauth_client.client_name, scopes: grant.scopes, connected_at: grant.created_at.iso8601, last_used_at: grant.last_used_at&.iso8601, revoked_at: grant.revoked_at&.iso8601 } },
        notes: [
          "Raw IP addresses of your visitors are not included: they are cleared after 90 days and belong to the people who clicked.",
          "Uploaded images are listed as answers of type image; ask the owner of the service for the files.",
        ],
      }
    end

    private

    attr_reader :user

    def responses_total
      FormResponse.where(form_id: user.forms.select(:id)).count
    end

    def account
      {
        email: user.email,
        created_at: user.created_at.iso8601,
        verified_at: user.verified_at&.iso8601,
        has_password: user.password?,
        sign_in_providers: user.identities.pluck(:provider),
      }
    end

    def shortlinks
      user.shortlinks.order(:id).map do |link|
        {
          short_code: link.short_code,
          original_url: link.original_url,
          title: link.title,
          created_at: link.created_at.iso8601,
          expires_at: link.expires_at&.iso8601,
          active: link.inactive_at.nil?,
          password_protected: link.password_protected?,
          clicks: link.events_count,
        }
      end
    end

    def pages
      user.pages.includes(:page_links).order(:id).map do |page|
        {
          slug: page.slug,
          display_title: page.display_title,
          bio: page.bio,
          theme: page.theme,
          custom_colors: page.custom_colors,
          published: page.published,
          created_at: page.created_at.iso8601,
          links: page.page_links.map { |link| { label: link.label, url: link.url, kind: link.kind, icon: link.icon, active: link.active, position: link.position, clicks: link.clicks_count } },
        }
      end
    end

    def forms
      user.forms.order(:id).map do |form|
        questions = form.fields.select { |field| Forms::FieldSchema.answerable?(field) }
        {
          title: form.title,
          description: form.description,
          thank_you_message: form.thank_you_message,
          theme: form.theme,
          custom_colors: form.custom_colors,
          layout: form.layout,
          published: form.published,
          created_at: form.created_at.iso8601,
          public_url: form.public_url,
          questions: form.fields.map { |field| field.slice("type", "label", "help", "required", "choices", "max_choices", "scale", "min", "max") },
          responses: form.responses.order(:id).find_each.map { |response| response_json(response, questions) },
        }
      end
    end

    def response_json(response, questions)
      {
        submitted_at: response.created_at.iso8601,
        answers: questions.filter_map { |field| response.answers.key?(field["id"]) ? [field["label"], value(field, response.answers[field["id"]])] : nil }.to_h,
        country: response.country,
        platform: response.platform,
        browser: response.browser,
        source: response.source,
      }
    end

    def value(field, raw)
      case field["type"]
      when "single_choice" then label(field, raw)
      when "multiple_choice" then Array(raw).map { |id| label(field, id) }
      when "image" then { type: "image" }
      else raw
      end
    end

    def label(field, id)
      field["choices"].to_a.find { |choice| choice["id"] == id }&.fetch("label") || "(removed option)"
    end

    def page_templates
      user.page_templates.order(:id).map { |template| { name: template.name, description: template.description, theme: template.theme, visibility: template.visibility, items: template.items, created_at: template.created_at.iso8601 } }
    end
  end
end
