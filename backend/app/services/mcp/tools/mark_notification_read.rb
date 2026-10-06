module Mcp
  module Tools
    class MarkNotificationRead < Mcp::BaseTool
      tool_name "mark_notification_read"
      title "Mark a notification as read"
      description "Marks one of the owner's bell notifications as read. Nothing else changes."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "appointments:write", writes: true, limits: [[120, 1.hour]]

      def self.perform(user:, id:)
        row = Notification.in_app.where(user_id: user.id, recipient_kind: "owner").find(id)
        row.update!(read_at: Time.current) if row.read_at.nil?
        { id: row.id, read_at: row.read_at.iso8601, unread_count: Notification.in_app.where(user_id: user.id, recipient_kind: "owner").unread.count }
      end
    end
  end
end
