class LoginMailer < ApplicationMailer
  def magic_link
    @user = params[:user]

    @code = @user.login_token
    mail(to: @user.email, subject: "Please verify your identity")
  end
end
