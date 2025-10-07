class UserSerializer < BaseSerializer
  with_id
  root_key_for_collection :user

  #------------
  # Attributes
  #------------
  attributes :email

  attribute :shortlinks_count do |record|
    record.shortlinks.count
  end
end
