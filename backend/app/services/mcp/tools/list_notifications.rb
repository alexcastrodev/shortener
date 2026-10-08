module Mcp
  module Tools
    class ListNotifications < Mcp::BaseTool
      PAGE = 20

      tool_name "list_notifications"
      title "List bell notifications"
      description "The account's in-app notifications, newest first: as the owner of a form (recipient_kind owner) and as a client of someone else's booking or waiting list (recipient_kind client). They carry only ids and counts, never names or emails; waiting-list notices also carry the form title, the service name and the time, plus a waitlist_path while the place is still open."
      input_schema(
        properties: { unread_only: { type: "boolean" }, before: { type: "integer", minimum: 1 }, limit: { type: "integer", minimum: 1, maximum: PAGE } },
        additionalProperties: false,
      )
      annotations(read_only_hint: true, open_world_hint: false)
      requires "appointments:read"

      def self.perform(user:, unread_only: false, before: nil, limit: 10)
        scope = Notification.bell(user)
        unread = scope.unread.count
        scope = scope.unread if unread_only
        scope = scope.where(id: ...before) if before
        rows = scope.order(id: :desc).limit(limit + 1).to_a
        more = rows.size > limit
        rows = rows.first(limit)

        {
          unread_count: unread,
          notifications: Notification.present(rows, user),
          next_before: more ? rows.last.id : nil,
        }
      end
    end
  end
end
