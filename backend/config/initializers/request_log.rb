module RequestLogWithoutIp
  private

  def started_request_message(request)
    format('Started %s "%s" at %s', request.raw_request_method, request.filtered_path, Time.now)
  end
end

Rails::Rack::Logger.prepend(RequestLogWithoutIp)
