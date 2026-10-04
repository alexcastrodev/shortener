# Prints every route as ROUTE:<VERB> <path> <controller#action> (run.sh stores them in out/routes.txt).
Rails.application.routes.routes.each do |r|
  path = r.path.spec.to_s.sub("(.:format)", "")
  verb = r.verb.presence || "ANY"
  puts "ROUTE:#{verb} #{path} #{r.defaults[:controller]}##{r.defaults[:action]}"
end
