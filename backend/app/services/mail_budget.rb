# The email provider's plan limits (Resend free: 100 a day, 3,000 a month),
# enforced before a message is queued. A sign-in code expires in minutes, so
# waiting for tomorrow's quota is useless: when the budget is spent the
# request is refused right away.
#
# New addresses only get part of the daily budget; the rest is kept for
# accounts that have signed in before, so someone flooding the sign-up form
# with fresh addresses cannot lock existing users out.
module MailBudget
  extend self

  Result = Data.define(:ok, :reason) do
    def ok? = ok
  end

  def daily_limit = ENV.fetch("MAIL_DAILY_LIMIT", 100).to_i
  def monthly_limit = ENV.fetch("MAIL_MONTHLY_LIMIT", 3000).to_i
  def new_address_daily_limit = ENV.fetch("MAIL_NEW_ADDRESS_DAILY_LIMIT", 40).to_i

  # Counts one message against the budget, or refuses it. Counters live in
  # the Redis cache (atomic increments shared by every web container); a
  # refused reservation gives its increments back.
  def reserve(new_address:)
    taken = []
    counters(new_address).each do |key, limit, reason, ttl|
      taken << key
      next if Rails.cache.increment(key, 1, expires_in: ttl).to_i <= limit

      taken.each { |counter| Rails.cache.decrement(counter, 1) }
      alert(reason)
      return Result.new(ok: false, reason: reason)
    end
    Result.new(ok: true, reason: nil)
  end

  def usage
    today = Time.current.utc
    {
      day: Rails.cache.read(day_key(today), raw: true).to_i,
      month: Rails.cache.read(month_key(today), raw: true).to_i,
      new_addresses: Rails.cache.read(new_key(today), raw: true).to_i,
    }
  end

  private

  def counters(new_address)
    now = Time.current.utc
    list = [
      [day_key(now), daily_limit, :daily_limit, 2.days],
      [month_key(now), monthly_limit, :monthly_limit, 32.days],
    ]
    list << [new_key(now), new_address_daily_limit, :new_address_limit, 2.days] if new_address
    list
  end

  def day_key(time) = "mail_budget:day:#{time.strftime("%Y-%m-%d")}"
  def month_key(time) = "mail_budget:month:#{time.strftime("%Y-%m")}"
  def new_key(time) = "mail_budget:new:#{time.strftime("%Y-%m-%d")}"

  # Once per reason per day: hitting a limit usually means abuse.
  def alert(reason)
    key = "mail_budget:alerted:#{reason}:#{Time.current.utc.strftime("%Y-%m-%d")}"
    return unless Rails.cache.write(key, 1, expires_in: 1.day, unless_exist: true)

    Sentry.capture_message("Email budget reached: #{reason}", level: :warning, extra: usage)
  end
end
