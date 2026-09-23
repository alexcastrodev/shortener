require "rqrcode"

# Dark modules on a white background regardless of theme: low-contrast QR
# codes fail on cheaper phone cameras.
module QrCodeService
  extend self

  def svg(url)
    RQRCode::QRCode.new(url, level: :m).as_svg(
      module_size: 8,
      standalone: true,
      use_path: true,
      viewbox: true,
      color: "000",
      fill: "fff",
    )
  end
end
