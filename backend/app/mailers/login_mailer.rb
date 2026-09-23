class LoginMailer < ApplicationMailer
  # Sign-in code for passwordless login. Plain wording and a text part next to
  # the HTML: "verify your identity" phrasing and HTML-only mail both push
  # these into spam.
  def magic_link
    @user = params[:user]
    @code = @user.login_token
    @valid_minutes = User::LOGIN_TOKEN_TTL.in_minutes.to_i

    mail(to: @user.email, subject: "#{@code} is your Kurz sign-in code")
  end
end
