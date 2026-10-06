# The signed-in user's own view: adds how the account can sign in. Kept out
# of UserSerializer, which also renders lists (admin, shortlink owners).
class CurrentUserSerializer < UserSerializer
  root_key :user

  attribute :deletion_due_at do |user|
    user.deletion_due_at&.iso8601
  end

  attributes :time_zone, :locale

  attribute :has_password do |user|
    user.password?
  end

  attribute :google_connected do |user|
    user.identities.exists?(provider: GoogleSignIn::PROVIDER)
  end
end
