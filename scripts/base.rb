require 'open3'
require 'shellwords'

module Shell
  class CommandError < StandardError; end
  def run_command(command, raise_on_failure: true)
    puts "▶ #{command}"
    
    stdout, stderr, status = Open3.capture3(command)

    puts stdout unless stdout.empty?
    warn stderr unless stderr.empty?
    
    if !status.success? && raise_on_failure
      raise CommandError, "Command failed with exit code #{status.exitstatus}: #{stderr}"
    end
    
    [stdout, stderr, status]
  end

  def build_image(image)
    puts "\n🔨 Building #{image[:name]}:#{image[:tag]}..."
    
    validate_image_config!(image)
    
    cmd = "docker build " \
          "-f #{Shellwords.escape(image[:dockerfile])} " \
          "-t #{image[:name]}:#{image[:tag]} " \
          "#{Shellwords.escape(image[:context])}"
    
    run_command(cmd)
    puts "✓ Build completed"
  end

  def tag_image(image)
    puts "🏷️  Tagging #{image[:name]}:#{image[:tag]} → #{REGISTRY}/#{image[:name]}:#{image[:tag]}"
    
    cmd = "docker tag #{image[:name]}:#{image[:tag]} #{REGISTRY}/#{image[:name]}:#{image[:tag]}"
    run_command(cmd)
  end

  def push_image(image)
    full_name = "#{REGISTRY}/#{image[:name]}:#{image[:tag]}"
    puts "📤 Pushing #{full_name}..."
    
    run_command("docker push #{full_name}")
    puts "✓ Push completed"
  end

  def publish_image(image)
    full_name = "#{REGISTRY}/#{image[:name]}:#{image[:tag]}"
    
    begin
      puts "\n" + "=" * 60
      puts "Publishing: #{full_name}"
      puts "=" * 60
      
      Dir.chdir(PROJECT_DIR) do
        build_image(image)
        tag_image(image)
        push_image(image)
      end
      
      puts "\n✅ Successfully published #{full_name}\n"
    rescue Interrupt
      puts "\n⚠️  Build cancelled by user"
      exit 1
    rescue CommandError => e
      puts "\n❌ Command error: #{e.message}"
      exit 1
    rescue StandardError => e
      puts "\n❌ Error: #{e.message}"
      puts e.backtrace.join("\n")
      exit 1
    end
  end

  def validate_image_config!(image)
    required_keys = [:name, :tag, :dockerfile, :context]
    missing_keys = required_keys - image.keys
    
    raise ArgumentError, "Missing keys: #{missing_keys.join(', ')}" if missing_keys.any?
    
    raise ArgumentError, "Dockerfile not found: #{image[:dockerfile]}" \
      unless File.exist?(image[:dockerfile])
  end

  def image_exists?(name, tag)
    stdout, _, status = run_command("docker images --quiet #{name}:#{tag}", raise_on_failure: false)
    status.success? && !stdout.strip.empty?
  end

  def remove_image(name, tag)
    puts "🗑️  Removing local image #{name}:#{tag}..."
    run_command("docker rmi #{name}:#{tag}", raise_on_failure: false)
    puts "✓ Image removed"
  end

  def inspect_image(name, tag)
    puts "🔍 Inspecting #{name}:#{tag}..."
    run_command("docker inspect #{name}:#{tag}")
  end
end