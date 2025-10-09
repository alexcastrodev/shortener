require "oj"

# Rails
# https://github.com/ohler55/oj/blob/develop/pages/Rails.md
Oj.optimize_rails

# Serializer
# https://github.com/okuramasafumi/alba?tab=readme-ov-file#configuration
# https://github.com/okuramasafumi/alba/issues/287
Alba.backend = :oj_rails
