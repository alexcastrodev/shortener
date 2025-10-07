# frozen_string_literal: true

class BaseSerializer
  include Alba::Resource

  meta nil

  def self.with_id
    attributes(:id)
  end

  def self.with_timestamps
    attribute(:created_at) do |record|
      record.created_at&.iso8601
    end

    attribute(:updated_at) do |record|
      record.updated_at&.iso8601
    end
  end

  def self.maybe_one(name, key: nil, **options)
    one(name, key: key, if: proc { |_| (@params[:includes] || []).include?(key || name.to_s) }, **options)
  end

  def self.maybe_many(name, key: nil, **options)
    many(name, key: key, if: proc { |_| (@params[:includes] || []).include?(key || name.to_s) }, **options)
  end
end
