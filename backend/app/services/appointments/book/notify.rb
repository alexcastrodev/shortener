module Appointments
  module Book
    module Notify
      extend self

      def announce(form:, first:, group:, email:, payload:, manual: false)
        Notification.notify_owner(
          user_id: form.user_id,
          kind: manual ? "appointment_requested" : "appointment_created",
          event_key: group,
          source: first,
          payload: payload,
        )
        queue_emails(form: form, first: first, group: group, email: email, payload: payload, manual: manual)
      end

      def queue_verification(first:, group:, email:, payload:)
        queued = Notification.queue_email(
          kind: "appointment_verify",
          event_key: group,
          source: first,
          recipient_kind: "client",
          recipient_email: email,
          payload: payload,
        )
        ActiveRecord.after_all_transactions_commit { NotificationDeliveryJob.perform_later(queued.id) }
      end

      private

      def queue_emails(form:, first:, group:, email:, payload:, manual: false)
        queued = [
          Notification.queue_email(
            kind: manual ? "appointment_requested" : "appointment_created",
            event_key: group,
            source: first,
            recipient_kind: "owner",
            user_id: form.user_id,
            payload: payload,
          ),
        ]
        if email.present?
          queued << Notification.queue_email(
            kind: manual ? "appointment_request_received" : "appointment_confirmed",
            event_key: group,
            source: first,
            recipient_kind: "client",
            recipient_email: email,
            payload: payload,
          )
        end
        ids = queued.compact.map(&:id)
        ActiveRecord.after_all_transactions_commit { ids.each { |id| NotificationDeliveryJob.perform_later(id) } }
      end
    end
  end
end
