class AccountMailer < ApplicationMailer
  def data_export
    @user = params[:user]
    attachments["kurz-data-#{Date.current.iso8601}.json"] = { mime_type: "application/json", content: params[:body] }

    with_recipient_locale(@user, nil) do
      mail(to: @user.email, subject: I18n.t("account_mailer.data_export.subject"))
    end
  end

  def data_export_too_large
    @user = params[:user]

    with_recipient_locale(@user, nil) do
      mail(to: @user.email, subject: I18n.t("account_mailer.data_export_too_large.subject"))
    end
  end

  def deletion_scheduled
    @user = params[:user]
    @due_on = @user.deletion_due_at.to_date.iso8601

    with_recipient_locale(@user, params[:locale]) do
      mail(to: @user.email, subject: I18n.t("account_mailer.deletion_scheduled.subject"))
    end
  end
end
