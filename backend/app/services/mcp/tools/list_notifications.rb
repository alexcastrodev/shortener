module Mcp
  module Tools
    class ListNotifications < Mcp::BaseTool
      PAGE = 20

      tool_name "list_notifications"
      title "List bell notifications"
      description "The owner's in-app notifications about appointments, newest first. They carry only ids and counts, never names or emails."
      input_schema(
        properties: { unread_only: { type: "boolean" }, before: { type: "integer", minimum: 1 }, limit: { type: "integer", minimum: 1, maximum: PAGE } },
        additionalProperties: false,
      )
      annotations(read_only_hint: true, open_world_hint: false)
      requires "appointments:read"

      def self.perform(user:, unread_only: false, before: nil, limit: 10)
        scope = Notification.in_app.where(user_id: user.id, recipient_kind: "owner")
        unread = scope.unread.count
        scope = scope.unread if unread_only
        scope = scope.where(id: ...before) if before
        rows = scope.order(id: :desc).limit(limit + 1).to_a
        more = rows.size > limit
        rows = rows.first(limit)

        {
          unread_count: unread,
          notifications: rows.map { |row| { id: row.id, kind: row.kind, payload: row.payload, read_at: row.read_at&.iso8601, created_at: row.created_at.iso8601 } },
          next_before: more ? rows.last.id : nil,
        }
      end
    end
  end
end
