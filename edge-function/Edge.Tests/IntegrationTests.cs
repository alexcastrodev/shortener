using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using RabbitMQ.Client;
using StackExchange.Redis;

public sealed class IntegrationTests : IAsyncLifetime
{
    const string Skip = "Set REDIS_URL and RABBITMQ_HOST to run the integration tests against Valkey and RabbitMQ";

    static readonly string? RedisUrl = Environment.GetEnvironmentVariable("REDIS_URL");
    static readonly string? RabbitHost = Environment.GetEnvironmentVariable("RABBITMQ_HOST");

    public static bool Configured => RedisUrl is not null && RabbitHost is not null;

    readonly CancellationToken ct = TestContext.Current.CancellationToken;
    ConnectionMultiplexer? redis;
    IConnection? rabbit;
    IChannel? channel;

    IDatabase Db => redis!.GetDatabase();

    public async ValueTask InitializeAsync()
    {
        if (!Configured) return;
        redis = await ConnectionMultiplexer.ConnectAsync(Cache.RedisOptions(RedisUrl!));
        rabbit = await new ConnectionFactory
        {
            HostName = RabbitHost!,
            Port = int.Parse(Environment.GetEnvironmentVariable("RABBITMQ_PORT") ?? "5672"),
            UserName = Environment.GetEnvironmentVariable("RABBITMQ_DEFAULT_USER") ?? ConnectionFactory.DefaultUser,
            Password = Environment.GetEnvironmentVariable("RABBITMQ_DEFAULT_PASS") ?? ConnectionFactory.DefaultPass,
        }.CreateConnectionAsync(ct);
        channel = await rabbit.CreateChannelAsync(cancellationToken: ct);
        await channel.QueueDeclareAsync("analytics", durable: true, exclusive: false, autoDelete: false, arguments: null, cancellationToken: ct);
        await channel.QueuePurgeAsync("analytics", ct);
    }

    public async ValueTask DisposeAsync()
    {
        if (channel is not null) await channel.DisposeAsync();
        if (rabbit is not null) await rabbit.DisposeAsync();
        if (redis is not null) await redis.DisposeAsync();
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task RedirectsAUrlEntryAndPublishesOneClick()
    {
        var code = await Store("""{"t":"url","v":"https://münchen.de/a?b=1"}""");
        await using var app = new WebApplicationFactory<Program>();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/" + code);
        request.Headers.Add("cf-connecting-ip", "203.0.113.9");
        request.Headers.Add("cf-ipcountry", "br");
        request.Headers.Add("user-agent", "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0");

        using var response = await Client(app).SendAsync(request, ct);

        Assert.Equal(HttpStatusCode.Found, response.StatusCode);
        Assert.Equal("https://xn--mnchen-3ya.de/a?b=1", response.Headers.Location?.OriginalString);
        var click = Assert.Single(await Clicks(code, 1));
        Assert.Equal(
            ["country_code", "region", "browser", "ip_address", "platform", "referer", "user_agent", "shortlink_code", "timestamp"],
            click.EnumerateObject().Select(property => property.Name));
        Assert.Equal("BR", click.GetProperty("country_code").GetString());
        Assert.Equal(JsonValueKind.Null, click.GetProperty("region").ValueKind);
        Assert.Equal("Firefox", click.GetProperty("browser").GetString());
        Assert.Equal("203.0.113.9", click.GetProperty("ip_address").GetString());
        Assert.Equal("Linux", click.GetProperty("platform").GetString());
        Assert.Equal("", click.GetProperty("referer").GetString());
        Assert.Equal(code, click.GetProperty("shortlink_code").GetString());
        Assert.InRange(DateTimeOffset.Parse(click.GetProperty("timestamp").GetString()!), DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow);
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task SendsALockedEntryToThePasswordPageWithoutPublishing()
    {
        var code = await Store("""{"t":"locked"}""");
        await using var app = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(host => host.UseSetting("FRONTEND_URL", "https://front.example"));

        using var response = await Client(app).GetAsync("/" + code, ct);

        Assert.Equal(HttpStatusCode.Found, response.StatusCode);
        Assert.Equal($"https://front.example/s/{code}", response.Headers.Location?.OriginalString);
        Assert.Empty(await Clicks(code, 0));
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task RedirectsAMissingKeyToTheNotFoundPage()
    {
        await using var app = new WebApplicationFactory<Program>();

        using var response = await Client(app).GetAsync("/missing-" + Guid.NewGuid().ToString("N"), ct);

        Assert.Equal(HttpStatusCode.Found, response.StatusCode);
        Assert.Equal("/404", response.Headers.Location?.OriginalString);
    }

    [Theory(Skip = Skip, SkipUnless = nameof(Configured))]
    [InlineData("/")]
    [InlineData("/404")]
    public async Task ServesTheNotFoundPage(string path)
    {
        await using var app = new WebApplicationFactory<Program>();

        using var response = await Client(app).GetAsync(path, ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("text/html; charset=utf-8", response.Content.Headers.ContentType?.ToString());
        Assert.Equal(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "404.html"), ct), await response.Content.ReadAsStringAsync(ct));
    }

    [Theory(Skip = Skip, SkipUnless = nameof(Configured))]
    [InlineData("GET", "/")]
    [InlineData("GET", "/404")]
    [InlineData("HEAD", "/")]
    [InlineData("HEAD", "/404")]
    public async Task FramesTheNotFoundPageWithAContentLengthOverKestrel(string method, string path)
    {
        await using var app = Kestrel(new WebApplicationFactory<Program>());

        var response = await Raw(app, Encoding.ASCII.GetBytes($"{method} {path} HTTP/1.1\r\nHost: kurz.test\r\nConnection: close\r\n\r\n"));

        var head = response[..response.IndexOf("\r\n\r\n", StringComparison.Ordinal)];
        Assert.StartsWith("HTTP/1.1 404", head);
        Assert.Contains("\r\nContent-Length: 4949", head);
        Assert.DoesNotContain("Transfer-Encoding", head);
        Assert.DoesNotContain("\r\nServer:", head);
        Assert.Equal(method == "HEAD" ? 0 : 4949, Encoding.UTF8.GetByteCount(response[(head.Length + 4)..]));
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task RedirectsWhenRefererAndUserAgentAreNotValidUtf8()
    {
        var code = await Store("""{"t":"url","v":"https://example.com/bytes"}""");
        await using var app = Kestrel(new WebApplicationFactory<Program>());

        var response = await Raw(app, [
            .. Encoding.ASCII.GetBytes($"GET /{code} HTTP/1.1\r\nHost: kurz.test\r\nConnection: close\r\nReferer: https://t.co/"),
            0xff, 0xe9,
            .. "\r\nUser-Agent: Firefox/128.0 "u8, 0xc3,
            .. "\r\n\r\n"u8,
        ]);

        Assert.StartsWith("HTTP/1.1 302", response);
        Assert.Contains("\r\nLocation: https://example.com/bytes\r\n", response);
        var click = Assert.Single(await Clicks(code, 1));
        Assert.Equal("https://t.co/\uFFFD\uFFFD", click.GetProperty("referer").GetString());
        Assert.Equal("Firefox", click.GetProperty("browser").GetString());
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task AnswersUnavailableWhileValkeyIsUnreachableAndRecoversOnItsOwn()
    {
        var code = await Store("""{"t":"url","v":"https://example.com/back"}""");
        await using var proxy = Proxy();
        await using var app = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(host => host.UseSetting("REDIS_URL", $"redis://127.0.0.1:{proxy.Port}/0"));
        var client = Client(app);
        using (var before = await client.GetAsync("/" + code, ct))
            Assert.Equal(HttpStatusCode.Found, before.StatusCode);

        proxy.Refuse();
        await Task.Delay(500, ct);
        var watch = Stopwatch.StartNew();
        using (var down = await client.GetAsync("/" + code, ct))
        {
            watch.Stop();
            await AssertUnavailable(down);
            Assert.InRange(watch.Elapsed, TimeSpan.Zero, TimeSpan.FromMilliseconds(1500));
        }

        proxy.Forward();
        Assert.Equal(HttpStatusCode.Found, await EventuallyRedirects(client, code));
        Assert.Equal(2, (await Clicks(code, 2)).Count);
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task AnswersUnavailableAfterTwoSecondsWhenValkeyHangs()
    {
        var code = await Store("""{"t":"url","v":"https://example.com/hung"}""");
        await using var proxy = Proxy();
        await using var app = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(host => host.UseSetting("REDIS_URL", $"redis://127.0.0.1:{proxy.Port}/0"));
        var client = Client(app);
        using (var before = await client.GetAsync("/" + code, ct))
            Assert.Equal(HttpStatusCode.Found, before.StatusCode);

        proxy.Hang();
        var watch = Stopwatch.StartNew();
        using (var hung = await client.GetAsync("/" + code, ct))
        {
            watch.Stop();
            await AssertUnavailable(hung);
            Assert.InRange(watch.Elapsed, TimeSpan.FromMilliseconds(1900), TimeSpan.FromMilliseconds(4000));
        }

        proxy.Forward();
        Assert.Equal(HttpStatusCode.Found, await EventuallyRedirects(client, code));
        Assert.Equal(2, (await Clicks(code, 2)).Count);
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task RedirectsHeadAndPostRequests()
    {
        var code = await Store("""{"t":"url","v":"https://example.com/x"}""");
        await using var app = new WebApplicationFactory<Program>();
        var client = Client(app);

        using var head = await client.SendAsync(new HttpRequestMessage(HttpMethod.Head, "/" + code), ct);
        using var post = await client.PostAsync("/" + code, null, ct);

        foreach (var response in new[] { head, post })
        {
            Assert.Equal(HttpStatusCode.Found, response.StatusCode);
            Assert.Equal("https://example.com/x", response.Headers.Location?.OriginalString);
        }
        Assert.Equal(2, (await Clicks(code, 2)).Count);
    }

    [Fact(Skip = Skip, SkipUnless = nameof(Configured))]
    public async Task KeepsRedirectingWhenTheBrokerIsUnreachable()
    {
        var code = await Store("""{"t":"url","v":"https://example.com/down"}""");
        await using var app = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(host => host.UseSetting("RABBITMQ_PORT", "1"));
        var client = Client(app);

        for (var i = 0; i < 3; i++)
        {
            using var response = await client.GetAsync("/" + code, ct);
            Assert.Equal(HttpStatusCode.Found, response.StatusCode);
            Assert.Equal("https://example.com/down", response.Headers.Location?.OriginalString);
        }
        Assert.Empty(await Clicks(code, 0));
    }

    async Task AssertUnavailable(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("text/plain; charset=utf-8", response.Content.Headers.ContentType?.ToString());
        Assert.Equal("5", response.Headers.GetValues("Retry-After").Single());
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal("Service temporarily unavailable. Please try again shortly.", await response.Content.ReadAsStringAsync(ct));
        Assert.Null(response.Headers.Location);
    }

    async Task<HttpStatusCode> EventuallyRedirects(HttpClient client, string code)
    {
        var deadline = DateTime.UtcNow.AddSeconds(30);
        while (true)
        {
            using var response = await client.GetAsync("/" + code, ct);
            if (response.StatusCode != HttpStatusCode.ServiceUnavailable || DateTime.UtcNow > deadline) return response.StatusCode;
            await Task.Delay(250, ct);
        }
    }

    static ValkeyProxy Proxy()
    {
        var upstream = new Uri(RedisUrl!);
        return new ValkeyProxy(upstream.Host, upstream.Port > 0 ? upstream.Port : 6379);
    }

    static WebApplicationFactory<Program> Kestrel(WebApplicationFactory<Program> app)
    {
        app.UseKestrel(0);
        app.StartServer();
        return app;
    }

    async Task<string> Raw(WebApplicationFactory<Program> app, byte[] request)
    {
        using var socket = new TcpClient();
        await socket.ConnectAsync(IPAddress.Loopback, app.ClientOptions.BaseAddress.Port, ct);
        var stream = socket.GetStream();
        await stream.WriteAsync(request, ct);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return await reader.ReadToEndAsync(ct);
    }

    static HttpClient Client(WebApplicationFactory<Program> app) =>
        app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    async Task<string> Store(string value)
    {
        var code = "it" + Guid.NewGuid().ToString("N")[..10];
        await Db.StringSetAsync("shortlink:" + code, value, TimeSpan.FromMinutes(5));
        return code;
    }

    async Task<List<JsonElement>> Clicks(string code, int expected)
    {
        var clicks = new List<JsonElement>();
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (clicks.Count < expected && DateTime.UtcNow < deadline)
        {
            await Drain(code, clicks);
            await Task.Delay(100, ct);
        }
        await Task.Delay(TimeSpan.FromSeconds(2), ct);
        await Drain(code, clicks);
        return clicks;
    }

    async Task Drain(string code, List<JsonElement> clicks)
    {
        while (await channel!.BasicGetAsync("analytics", autoAck: true, ct) is { } message)
        {
            Assert.Equal("application/json", message.BasicProperties.ContentType);
            using var document = JsonDocument.Parse(message.Body);
            if (document.RootElement.GetProperty("shortlink_code").GetString() == code)
                clicks.Add(document.RootElement.Clone());
        }
    }
}
