module Mcp
  module Tools
    extend self

    def all
      [
        ListShortlinks,
        GetShortlinkStatistics,
        CreateShortlink,
        ListPages,
        GetPage,
        GetPageStatistics,
        ListPageTemplates,
        CreatePage,
        UpdatePage,
        AddPageLink,
        UpdatePageLink,
        RemovePageLink,
        ReorderPageLinks,
        ApplyPageTemplate,
        ListForms,
        GetForm,
        ListFormTemplates,
        CreateForm,
        CreateFormFromTemplate,
        UpdateForm,
        AddField,
        UpdateField,
        RemoveField,
        ReorderFields,
        PublishForm,
        UnpublishForm,
        PublishPage,
        UnpublishPage,
        UpdateShortlink,
        DeleteShortlink,
        DeletePage,
        DeleteForm,
        DuplicateForm,
        ApplyFormTemplate,
        DeleteResponse,
        DeleteAllResponses,
        ListResponses,
        GetResponse,
        GetSummary,
        GetBookingConfig,
        PreviewAvailability,
        GenerateTimeSlots,
        ListAppointments,
        GetAppointment,
        GetAgenda,
        ListNotifications,
        MarkNotificationRead,
      ]
    end

    def for_scopes(scopes, user: nil)
      all.select { |tool| tool.allowed?(scopes) && (!tool.required_scope.to_s.start_with?("appointments:") || Appointments::Config.enabled_for?(user)) }
    end

    def shortlink(link)
      {
        id: link.id,
        short_code: link.short_code,
        short_url: link.short_url,
        original_url: Mcp::Content.clean(link.original_url, max: 2048),
        title: link.title && Mcp::Content.clean(link.title, max: 120),
        expires_at: link.expires_at&.iso8601,
        active: link.inactive_at.nil?,
        password_protected: link.password_protected?,
        created_at: link.created_at.iso8601,
      }
    end
  end
end
