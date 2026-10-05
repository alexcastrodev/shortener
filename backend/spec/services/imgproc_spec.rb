require "rails_helper"

RSpec.describe(Imgproc) do
  let(:url) { "http://imgproc.test/convert" }

  around do |example|
    ENV["IMGPROC_URL"] = "http://imgproc.test"
    example.run
  ensure
    ENV.delete("IMGPROC_URL")
  end

  it "returns the converted bytes" do
    stub_request(:post, url).to_return(status: 200, body: "webp-bytes")

    expect(described_class.convert("raw")).to(eq("webp-bytes"))
  end

  it "maps rejections and failures to distinct errors" do
    [411, 413, 422].each do |status|
      stub_request(:post, url).to_return(status: status)
      expect { described_class.convert("raw") }.to(raise_error(Imgproc::Rejected))
    end

    [500, 502, 503].each do |status|
      stub_request(:post, url).to_return(status: status)
      expect { described_class.convert("raw") }.to(raise_error(Imgproc::Unavailable))
    end
  end

  it "reports unavailable when the sandbox is down, slow or not configured" do
    stub_request(:post, url).to_raise(Errno::ECONNREFUSED)
    expect { described_class.convert("raw") }.to(raise_error(Imgproc::Unavailable))

    stub_request(:post, url).to_timeout
    expect { described_class.convert("raw") }.to(raise_error(Imgproc::Unavailable))

    ENV.delete("IMGPROC_URL")
    expect { described_class.convert("raw") }.to(raise_error(Imgproc::Unavailable))
  end
end
