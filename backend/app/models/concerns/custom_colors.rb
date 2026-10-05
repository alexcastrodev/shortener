module CustomColors
  extend ActiveSupport::Concern

  KEYS = ["background", "text", "accent"].freeze
  HEX = /\A#\h{6}\z/
  JSON_SCHEMA = {
    type: ["object", "null"],
    description: "Overrides theme with your own colors (#RRGGBB). null goes back to the theme.",
    properties: KEYS.to_h { |key| [key.to_sym, { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }] },
    required: KEYS,
    additionalProperties: false,
  }.freeze

  included do
    normalizes :custom_colors, with: ->(colors) { colors&.stringify_keys&.transform_values { |hex| hex.to_s.downcase } }
    validate :custom_colors_shape
  end

  private

  def custom_colors_shape
    return if custom_colors.nil?
    valid = custom_colors.is_a?(Hash) && custom_colors.keys.sort == KEYS.sort && custom_colors.values.all? { |hex| hex.match?(HEX) }
    errors.add(:custom_colors, "must have #{KEYS.join(", ")} as #RRGGBB") unless valid
  end
end
