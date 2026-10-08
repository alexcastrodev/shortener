require "fileutils"
require "json"

accounts = {
  owner: "owner-e2e@example.test",
  client: "client-e2e@example.test",
  waiter: "waiter-e2e@example.test",
}

tokens = accounts.to_h do |role, email|
  user = User.find_or_initialize_by(email: email)
  user.assign_attributes(time_zone: "Europe/Lisbon", locale: "pt-PT", verified_at: Time.current)
  user.save!
  [role, SessionToken.issue(user)]
end

directory = File.expand_path("../.auth", __dir__)
FileUtils.mkdir_p(directory)
File.write(File.join(directory, "tokens.json"), JSON.pretty_generate(tokens))
