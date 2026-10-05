class DetectFormAbuseJob < ApplicationJob
  queue_as :default

  WINDOW = 1.hour
  MAX_RESPONSES = 600
  MAX_UPLOAD_BYTES = 300.megabytes

  def perform
    since = WINDOW.ago
    flooded = FormResponse.where(created_at: since..).group(:form_id).having("COUNT(*) > ?", MAX_RESPONSES).count
    heavy = upload_bytes(since).select { |_form_id, bytes| bytes > MAX_UPLOAD_BYTES }

    (flooded.keys | heavy.keys).each do |form_id|
      form = Form.where(published: true).find_by(id: form_id)
      next unless form

      contain(form, responses: flooded[form_id], bytes: heavy[form_id])
    end
  end

  private

  def upload_bytes(since)
    FormUpload.where(created_at: since..).joins(file_attachment: :blob).group(:form_id).sum("active_storage_blobs.byte_size")
  end

  def contain(form, responses:, bytes:)
    now = Time.current
    form.update!(published: false)

    signal = AbuseSignal.find_or_initialize_by(kind: "form_flood", fingerprint: "form:#{form.id}:#{now.to_date.iso8601}")
    created = signal.new_record?
    signal.assign_attributes(
      user_ids: (Array(signal.user_ids) | [form.user_id]).sort,
      form_ids: (Array(signal.form_ids) | [form.id]).sort,
      first_seen_at: signal.first_seen_at || now,
      last_seen_at: now,
      status: "open",
    )
    signal.save!

    Sentry.capture_message(
      "Form unpublished automatically: #{responses ? "#{responses} responses" : "#{bytes.to_i / 1.megabyte} MB of uploads"} in an hour",
      level: :warning,
      extra: { abuse_signal_id: signal.id, form_id: form.id, user_id: form.user_id },
    ) if created
  end
end
