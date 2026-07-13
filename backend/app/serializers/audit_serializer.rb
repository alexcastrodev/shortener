# frozen_string_literal: true

class AuditSerializer < BaseSerializer
  root_key_for_collection :audit

  attributes :id, :action, :audited_changes, :version, :remote_address, :request_uuid

  attribute :auditable_type do |audit|
    audit.auditable_type
  end

  attribute :auditable_id do |audit|
    audit.auditable_id
  end

  attribute :created_at do |audit|
    audit.created_at&.iso8601
  end

  one :user, resource: UserSerializer, if: proc { |audit| audit.user_id.present? }
end
