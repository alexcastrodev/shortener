module Mcp
  module Content
    extend self

    MAX = 2_000
    KEEP_FORMAT = ["‌", "‍"].freeze

    def clean(value, max: MAX)
      text = value.to_s.scrub("").unicode_normalize(:nfc)
      text = text.each_char.reject { |char| dropped?(char) }.join
      text.length > max ? "#{text.first(max)}…" : text
    end

    private

    def dropped?(char)
      return false if ["\n", "\t"].include?(char)
      return true if char.match?(/\p{Cc}/)
      return false if KEEP_FORMAT.include?(char)

      char.match?(/\p{Cf}/) || (0xE0000..0xE0FFF).cover?(char.ord)
    end
  end
end
