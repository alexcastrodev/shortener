class AccountMailer < ApplicationMailer
  def deletion_scheduled
    @user = params[:user]
    @due_on = @user.deletion_due_at.to_date.iso8601

    with_recipient_locale(@user, params[:locale]) do
      mail(to: @user.email, subject: I18n.t("account_mailer.deletion_scheduled.subject"))
    end
  end
end
