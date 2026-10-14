using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

public class HeadersTests
{
    [Theory]
    [InlineData("Chrome on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", "Chrome", "Windows")]
    [InlineData("Edge on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0", "Edge", "Windows")]
    [InlineData("Safari on macOS", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", "Safari", "macOS")]
    [InlineData("Firefox on Linux", "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0", "Firefox", "Linux")]
    [InlineData("Chrome on Android", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36", "Chrome", "Android")]
    [InlineData("Safari on iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "Safari", "iOS")]
    [InlineData("Chrome on iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1", "Chrome", "iOS")]
    [InlineData("Firefox on iPad", "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15", "Firefox", "iOS")]
    [InlineData("empty", "", "Unknown", "Unknown")]
    public void Detects(string name, string userAgent, string browser, string platform)
    {
        Assert.NotEmpty(name);
        Assert.Equal(browser, Headers.DetectBrowser(userAgent));
        Assert.Equal(platform, Headers.DetectPlatform(userAgent));
    }

    [Fact]
    public void ReadsCountryAndRegionFromCloudflareHeaders() =>
        Assert.Equal(("BR", "Sao Paulo"), Headers.Location(new HeaderDictionary { ["cf-ipcountry"] = "br", ["cf-region"] = "Sao Paulo" }));

    [Theory]
    [InlineData("XX")]
    [InlineData("T1")]
    [InlineData("xx")]
    [InlineData(" t1 ")]
    public void TreatsUnknownAndTorCountriesAsMissing(string country) =>
        Assert.Equal((null, null), Headers.Location(new HeaderDictionary { ["cf-ipcountry"] = country }));

    [Fact]
    public void ReturnsNullsWithoutCloudflareHeaders() =>
        Assert.Equal((null, null), Headers.Location(new HeaderDictionary()));

    [Fact]
    public void TrimsCountryAndRegion() =>
        Assert.Equal(("PT", null), Headers.Location(new HeaderDictionary { ["cf-ipcountry"] = " pt ", ["cf-region"] = "  " }));

    [Theory]
    [InlineData(" 203.0.113.9 ", "10.0.0.1", "203.0.113.9")]
    [InlineData(null, "10.0.0.1", "10.0.0.1")]
    [InlineData("   ", "10.0.0.1", "10.0.0.1")]
    [InlineData(null, "::ffff:10.0.0.1", "10.0.0.1")]
    [InlineData(null, "2001:db8::1", "2001:db8::1")]
    [InlineData(null, null, "")]
    public void PrefersCfConnectingIpOverTheSocketAddress(string? cfConnectingIp, string? remote, string expected)
    {
        var headers = new HeaderDictionary { ["X-Forwarded-For"] = "198.51.100.1", ["X-Real-IP"] = "198.51.100.2" };
        if (cfConnectingIp is not null) headers["cf-connecting-ip"] = cfConnectingIp;
        Assert.Equal(expected, Headers.IpAddress(headers, remote is null ? null : IPAddress.Parse(remote)));
    }

    [Fact]
    public void DefaultsRefererAndUserAgentToEmptyStrings()
    {
        var click = Headers.Click(new HeaderDictionary(), null, "abc123", DateTimeOffset.Parse("2026-10-14T12:34:56.789+00:00"));
        Assert.Equal(new Click(null, null, "Unknown", "", "Unknown", "", "", "abc123", "2026-10-14T12:34:56.789Z"), click);
    }

    [Fact]
    public void CapsRefererAndUserAgent()
    {
        var userAgent = "Mozilla/5.0 (Windows NT 10.0) " + new string('a', 10_000) + " Edg/126.0";
        var click = Headers.Click(new HeaderDictionary { ["user-agent"] = userAgent, ["referer"] = new string('r', 5_000) }, null, "abc123", DateTimeOffset.UtcNow);
        Assert.Equal(userAgent[..4096], click.UserAgent);
        Assert.Equal(new string('r', 4096), click.Referer);
        Assert.Equal("Edge", click.Browser);
    }

    [Fact]
    public void SerializesTheClickWithTheKeysTheWorkerReads()
    {
        var headers = new HeaderDictionary
        {
            ["cf-ipcountry"] = "br",
            ["cf-connecting-ip"] = "203.0.113.9",
            ["referer"] = "https://t.co/",
            ["user-agent"] = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
        };
        var click = Headers.Click(headers, IPAddress.Loopback, "abc123", new DateTimeOffset(2026, 10, 14, 9, 0, 0, TimeSpan.FromHours(-3)));

        Assert.Equal(
            """{"country_code":"BR","region":null,"browser":"Firefox","ip_address":"203.0.113.9","platform":"Linux","referer":"https://t.co/","user_agent":"Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0","shortlink_code":"abc123","timestamp":"2026-10-14T12:00:00.000Z"}""",
            JsonSerializer.Serialize(click, ClickJson.Default.Click));
    }
}
