class LoginMailer < ApplicationMailer
  def magic_link
    @user = params[:user]
    @url = "#{ENV['FRONTEND_URL']}/login?token=#{@user.login_token}"
    mail(to: @user.email, subject: "Auth")
  end
end
