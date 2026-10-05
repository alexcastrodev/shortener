def make(email, admin: false, deactivated: false)
  user = User.find_or_initialize_by(email: email)
  user.assign_attributes(admin: admin, verified_at: Time.current, deactivated_at: (Time.current if deactivated))
  user.save!(validate: false)
  user
end

TENANTS = {
  a: make("owner-a@sec.test"),
  b: make("owner-b@sec.test"),
  admin: make("admin@sec.test", admin: true),
  deactivated: make("owner-d@sec.test", deactivated: true),
}.freeze

def token(name)
  SessionToken.issue(TENANTS.fetch(name))
end
