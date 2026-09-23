class LoginMailer < ApplicationMailer
  # The emailed code, worded for what it is for. Plain wording and a text part
  # next to the HTML: "verify your identity" phrasing and HTML-only mail both
  # push these into spam.
  COPY = {
    "sign_in" => {
      subject: "%{code} is your Kurz sign-in code",
      title: "Your sign-in code",
      body: "Enter this code on the Kurz sign-in page to continue.",
      reason: "someone asked to sign in to Kurz with %{email}",
    },
    "sign_up" => {
      subject: "%{code} is your Kurz confirmation code",
      title: "Confirm your new account",
      body: "Enter this code to finish creating your Kurz account.",
      reason: "someone started creating a Kurz account with %{email}",
    },
    "sign_up_existing" => {
      subject: "%{code} is your Kurz confirmation code",
      title: "Confirm it's you",
      body: "This email already has a Kurz account. Enter this code to finish signing up: " \
        "the password you just chose becomes your password, and other sessions are signed out.",
      reason: "someone tried to create a Kurz account with %{email}",
    },
    "password_reset" => {
      subject: "%{code} is your Kurz password reset code",
      title: "Reset your password",
      body: "Enter this code to choose a new password for your Kurz account.",
      reason: "someone asked to reset the password of the Kurz account %{email}",
    },
  }.freeze

  def magic_link
    @user = params[:user]
    @code = @user.login_token
    @valid_minutes = User::LOGIN_TOKEN_TTL.in_minutes.to_i
    copy = COPY.fetch(params[:purpose].to_s, COPY["sign_in"])
    @title = copy[:title]
    @body = copy[:body]
    @reason = format(copy[:reason], email: @user.email)

    mail(to: @user.email, subject: format(copy[:subject], code: @code))
  end
end
