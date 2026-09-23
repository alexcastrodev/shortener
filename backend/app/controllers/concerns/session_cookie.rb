# The session token lives in an httpOnly cookie, out of reach of page
# scripts (an XSS can no longer steal it). SameSite=Strict: kurz.fyi and
# api.kurz.fyi are the same site, so the frontend's requests carry it while
# requests started from other sites do not.
module SessionCookie
  extend ActiveSupport::Concern

  NAME = "kurz_session"

  private

  def set_session_cookie(token, expires_at)
    cookies[NAME] = {
      value: token,
      expires: expires_at,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :strict,
      path: "/",
    }
  end

  def clear_session_cookie
    cookies.delete(NAME, path: "/", same_site: :strict, secure: Rails.env.production?)
  end
end
