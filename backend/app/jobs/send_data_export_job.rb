class SendDataExportJob < ApplicationJob
  queue_as :mailers

  MAX_BYTES = 15.megabytes
  BUDGET_SHARE = 0.5

  class BudgetExhausted < StandardError; end

  retry_on BudgetExhausted, wait: 1.hour, attempts: :unlimited

  def perform(user_id)
    user = User.find_by(id: user_id)
    return unless user && (user.deactivated_at.nil? || user.pending_deletion?)

    raise BudgetExhausted unless MailBudget.reserve(new_address: false, share: BUDGET_SHARE).ok?

    json = Users::DataExport.call(user: user)
    body = JSON.pretty_generate(json)
    if body.bytesize > MAX_BYTES
      AccountMailer.with(user: user).data_export_too_large.deliver_now
    else
      AccountMailer.with(user: user, body: body).data_export.deliver_now
    end
  rescue Users::DataExport::TooLarge
    AccountMailer.with(user: user).data_export_too_large.deliver_now
  end
end
