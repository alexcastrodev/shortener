# Mirrors detectBrowser/detectPlatform in edge-function/headers.ts so clicks
# on bio page links are bucketed the same way as shortlink clicks.
module UserAgentParser
  extend self

  # Order matters: Edge and Chrome on iOS also contain "Safari", and Edge on
  # desktop also contains "Chrome", so the more specific tokens go first.
  def browser(user_agent)
    return "Edge" if user_agent.match?(%r{Edg(e|A|iOS)?/})
    return "Firefox" if user_agent.match?(/Firefox|FxiOS/)
    return "Chrome" if user_agent.match?(/Chrome|CriOS/)
    return "Safari" if user_agent.include?("Safari")

    "Unknown"
  end

  # Android UAs contain "Linux" and iOS UAs contain "Mac OS X", so check the
  # mobile platforms first.
  def platform(user_agent)
    return "Android" if user_agent.match?(/Android/i)
    return "iOS" if user_agent.match?(/iPhone|iPad|iPod/i)
    return "Windows" if user_agent.include?("Windows")
    return "macOS" if user_agent.include?("Mac OS")
    return "Linux" if user_agent.include?("Linux")

    "Unknown"
  end
end
