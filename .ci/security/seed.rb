# Runs inside the api container (rails runner). Creates the tenants every check uses and writes
# their session tokens to /out/tokens.json. Resources are created through the real API by the checks.
require "json"

def make(email, admin: false, deactivated: false)
  user = User.find_or_initialize_by(email: email)
  user.assign_attributes(admin: admin, verified_at: Time.current, deactivated_at: (Time.current if deactivated))
  user.save!(validate: false)
  user
end

users = {
  ownerA: make("owner-a@sec.test"),
  ownerB: make("owner-b@sec.test"),
  admin: make("admin@sec.test", admin: true),
  ownerD: make("owner-d@sec.test", deactivated: true),
}

File.write("/out/tokens.json", JSON.pretty_generate(users.to_h { |k, u| [k, { id: u.id, token: SessionToken.issue(u) }] }))
puts "seeded #{users.size} users"
