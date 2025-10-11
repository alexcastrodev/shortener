class EventStatisticsSerializer < BaseSerializer
  root_key_for_collection :event_statistics

  attributes :country_code, :region, :platform, :browser, :count
end
