require_relative "harness"
include Harness

check("AV06", "imgproc stopped: uploads answer 503 uploads_unavailable with no row and no detail, text answers, the public form and the health check keep working") do
  user = User.create!(email: "chaos-#{SecureRandom.hex(4)}@example.test", verified_at: Time.current)
  form = Form.create!(user: user, title: "Chaos", published: true, fields: [
    { "id" => "text0001", "type" => "short_text", "label" => "Say" },
    { "id" => "photo001", "type" => "image", "label" => "Photo" },
  ])
  png = Vips::Image.black(40, 30).copy(interpretation: :b_w).write_to_buffer(".png")
  boundary = "----chaos#{SecureRandom.hex(8)}"
  body = "--#{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\nContent-Type: image/png\r\n\r\n".b + png.b + "\r\n--#{boundary}--\r\n".b

  response = http(:post, "/api/public/forms/#{form.public_id}/fields/photo001/uploads", raw: body, headers: { "Content-Type" => "multipart/form-data; boundary=#{boundary}" })
  expect_eq(503, response.status, "upload while the sandbox is down")
  expect_eq({ "error" => "uploads_unavailable" }, response.json, "body")
  expect(!response.body.match?(/imgproc|8080|ECONN|resolve/i), "details leaked: #{response.body}")
  expect_eq(0, sql("select count(*) from form_uploads where form_id = #{form.id}").to_i, "row left behind")

  expect_eq(201, http(:post, "/api/public/forms/#{form.public_id}/responses", body: { answers: { "text0001" => "still works" } }).status, "text answer")
  expect_eq(200, http(:get, "/api/public/forms/#{form.public_id}").status, "public form")
  expect_eq(200, http(:get, "/up").status, "health")
end

File.write("/tmp/harness-failed", Harness.failed? ? "1" : "0")
puts "== #{Harness.results.count { |r| r[2] == 'PASS' }}/#{Harness.results.size} chaos checks passed"
exit(Harness.failed? ? 1 : 0)
