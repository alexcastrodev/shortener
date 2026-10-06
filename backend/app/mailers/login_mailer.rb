class LoginMailer < ApplicationMailer
  # The emailed code, worded for what it is for. Plain wording and a text part
  # next to the HTML: "verify your identity" phrasing and HTML-only mail both
  # push these into spam. The wording lives in config/locales.
  PURPOSES = ["sign_in", "sign_up", "sign_up_existing", "password_reset"].freeze

  def magic_link
    @user = params[:user]
    @code = @user.login_token
    @valid_minutes = User::LOGIN_TOKEN_TTL.in_minutes.to_i
    purpose = PURPOSES.include?(params[:purpose].to_s) ? params[:purpose].to_s : "sign_in"

    with_recipient_locale(@user, params[:locale]) do
      scope = "login_mailer.copy.#{purpose}"
      @title = I18n.t("#{scope}.title")
      @body = I18n.t("#{scope}.body")
      @reason = I18n.t("#{scope}.reason", email: @user.email)

      mail(to: @user.email, subject: I18n.t("#{scope}.subject", code: @code))
    end
  end
end
