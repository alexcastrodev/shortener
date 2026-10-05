Rails.application.config.to_prepare do
  [
    ActiveStorage::Blobs::ProxyController,
    ActiveStorage::Blobs::RedirectController,
    ActiveStorage::Representations::ProxyController,
    ActiveStorage::Representations::RedirectController,
  ].each { |controller| controller.include(FormBlobGuard) }
end
