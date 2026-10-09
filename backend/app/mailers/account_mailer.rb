class AccountMailer < ApplicationMailer
  def data_export
    @user = params[:user]
    attachments["kurz-data-#{Date.current.iso8601}.json"] = { mime_type: "application/json", content: params[:body] }
    to_user
  end

  def data_export_too_large
    @user = params[:user]
    to_user
  end

  def deletion_scheduled
    @user = params[:user]
    @status = :deletion
    @due_on = @user.deletion_due_at.to_date
    @sign_in_url = "#{frontend_url}/login"
    to_user(params[:locale])
  end

  private

  def to_user(requested = nil)
    with_recipient_locale(requested, @user) do
      @footer_lines = [I18n.t("mailer.why_account", email: @user.email)]
      mail(to: @user.email, subject: I18n.t("account_mailer.#{action_name}.subject"))
    end
  end
end
