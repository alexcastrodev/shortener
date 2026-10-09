module MailerHelper
  TONES = {
    teal: ["#dff3ef", "#0b5c53"],
    amber: ["#fcefd4", "#7a4900"],
    blue: ["#e3edfb", "#21508f"],
    red: ["#f9e4e2", "#962a24"],
  }.freeze

  STATUS_TONES = {
    confirmed: :teal,
    new_booking: :teal,
    offered: :teal,
    pending: :amber,
    verify: :amber,
    waitlist: :amber,
    reminder: :blue,
    rescheduled: :blue,
    cancelled: :red,
    declined: :red,
    deletion: :red,
  }.freeze

  def status_tone(status) = STATUS_TONES.fetch(status)

  def status_colors(status) = TONES.fetch(status_tone(status))

  def mail_day(time)
    I18n.l(time, format: time.year == Time.current.year ? :mail_day : :mail_day_year)
  end

  def mail_session(starts_at, zone, minutes = nil)
    starts = starts_at.in_time_zone(zone)
    ends = starts + minutes.to_i.minutes if minutes.to_i.positive?
    "#{mail_day(starts)} · #{[starts, ends].compact.map { |time| I18n.l(time, format: :mail_hour) }.join("–")}"
  end

  def mail_moment(time, zone) = I18n.l(time.in_time_zone(zone), format: :mail_moment)

  def mail_total(amount, currency, free = 0)
    price = "#{ActiveSupport::NumberHelper.number_to_rounded(amount, precision: 2)} #{currency}"
    free.to_i.positive? ? "#{price} · #{I18n.t("mailer.free", count: free.to_i)}" : price
  end

  def booking_rows(service:, starts:, zone:, minutes: nil, who: nil, total: nil, extra: [])
    label = starts.one? ? I18n.t("mailer.when") : I18n.t("mailer.sessions", count: starts.size)
    rows = [[I18n.t("mailer.service"), service]]
    rows << [I18n.t("mailer.#{who.first}"), who.last] if who&.last.present?
    rows << [label, starts.map { |time| mail_session(time, zone, minutes) }, I18n.t("mailer.zone", zone: zone.tr("_", " "))]
    rows.concat(extra.select { |_, value| value.present? }.map { |label, value| [label, value, nil, :quiet] })
    rows << [I18n.t("mailer.total"), mail_total(*total)] if total
    rows
  end
end
