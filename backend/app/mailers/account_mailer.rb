class AccountMailer < ApplicationMailer
  def deletion_scheduled
    @user = params[:user]
    @due_on = @user.deletion_due_at.to_date.iso8601
    mail(to: @user.email, subject: "Your Kurz account is scheduled for deletion")
  end
end
