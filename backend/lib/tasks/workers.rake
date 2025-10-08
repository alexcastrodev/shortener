namespace :workers do
  desc "Run Sneakers with all workers in app/workers"
  task run: :environment do
    require "sneakers"
    require "sneakers/runner"

    worker_classes = []

    Dir[Rails.root.join("app/workers/**/*_worker.rb")].each do |f|
      require f
      class_name = File.basename(f, ".rb").camelize
      worker_classes << Object.const_get(class_name) if Object.const_defined?(class_name)
    end

    Rails.application.eager_load!

    if worker_classes.empty?
      puts "⚠️  not found workers app/workers/**/*_worker.rb"
      exit 1
    end

    puts "✅ workers found: #{worker_classes.map(&:name).join(', ')}"

    runner = Sneakers::Runner.new(worker_classes)
    runner.run
  end
end
