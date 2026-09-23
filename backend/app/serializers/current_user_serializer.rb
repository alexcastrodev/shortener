# The signed-in user's own view: adds how the account can sign in. Kept out
# of UserSerializer, which also renders lists (admin, shortlink owners).
class CurrentUserSerializer < UserSerializer
  root_key :user

  attribute :has_password do |user|
    user.password?
  end

  attribute :google_connected do |user|
    user.identities.exists?(provider: GoogleSignIn::PROVIDER)
  end
end
