namespace :seed do
  desc "Create example link"
  task example: :environment do
    user = User.first_or_create!(
      email: "user@example.com",
    )

    link = Shortlink.create!(
      original_url: "https://kurz.fyi",
      title: "Sample",
      user: user,
    )

    puts "Test link: #{ENV["EDGE_API"]}/#{link.short_code}"
  end
end
