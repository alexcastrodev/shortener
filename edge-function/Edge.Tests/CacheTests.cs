using System.Net;
using StackExchange.Redis;

public class CacheTests
{
    const string Frontend = "https://kurz.fyi";

    [Fact]
    public void RedirectsAndTracksAJsonUrlEntry() =>
        Assert.Equal(
            new CacheAction("https://example.com/a?b=1", true),
            Cache.Resolve("""{"t":"url","v":"https://example.com/a?b=1"}""", "abc123", Frontend));

    [Fact]
    public void KeepsRedirectingLegacyRawUrlEntriesExactlyAsBefore() =>
        Assert.Equal(
            new CacheAction("https://example.com/legacy", true),
            Cache.Resolve("https://example.com/legacy", "abc123", Frontend));

    [Fact]
    public void SendsLockedLinksToThePasswordPageWithoutTracking() =>
        Assert.Equal(
            new CacheAction("https://kurz.fyi/s/abc123", false),
            Cache.Resolve("""{"t":"locked"}""", "abc123", Frontend));

    [Fact]
    public void EscapesTheShortCodeInThePasswordPageUrl() =>
        Assert.Equal(
            new CacheAction("https://kurz.fyi/s/a%2F..%2Fb", false),
            Cache.Resolve("""{"t":"locked"}""", "a/../b", Frontend));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void TreatsMissingValuesAsNotFound(string? value) =>
        Assert.Null(Cache.Resolve(value, "abc123", Frontend));

    [Theory]
    [InlineData("{not json")]
    [InlineData("null")]
    [InlineData("42")]
    [InlineData("\"https://example.com\"")]
    [InlineData("[]")]
    [InlineData("""{"t":"paused"}""")]
    [InlineData("""{"t":"url"}""")]
    [InlineData("""{"t":"url","v":42}""")]
    [InlineData("""{"t":"url","v":"javascript:alert(1)"}""")]
    [InlineData("javascript:alert(1)")]
    [InlineData("\"str\"")]
    [InlineData("""{"t":42}""")]
    [InlineData("""{"t":null}""")]
    [InlineData("""{"t":"url","v":null}""")]
    [InlineData("""{"t":"url","v":{}}""")]
    [InlineData("""{"t":"url","v":"JAVASCRIPT:alert(1)"}""")]
    [InlineData("""{"t":"url","v":"ftp://example.com/x"}""")]
    [InlineData("not a url")]
    public void DoesNotBreakOnMalformedOrUnknownEntries(string value) =>
        Assert.Null(Cache.Resolve(value, "abc123", Frontend));

    [Theory]
    [InlineData("https://münchen.de/straße", "https://xn--mnchen-3ya.de/stra%C3%9Fe")]
    [InlineData("https://example.com/café?q=ação", "https://example.com/caf%C3%A9?q=a%C3%A7%C3%A3o")]
    [InlineData("HTTPS://EXAMPLE.COM/Path?Q=1", "https://example.com/Path?Q=1")]
    [InlineData("https://EXAMPLE.com:443/x", "https://example.com/x")]
    [InlineData("http://example.com:80/x", "http://example.com/x")]
    [InlineData("http://example.com:8080/x", "http://example.com:8080/x")]
    [InlineData("https://example.com", "https://example.com/")]
    [InlineData("https://example.com/a#frag", "https://example.com/a#frag")]
    public void NormalizesTheLocationLikeTheWhatwgUrlParser(string url, string location)
    {
        Assert.Equal(new CacheAction(location, true), Cache.Resolve($$"""{"t":"url","v":"{{url}}"}""", "abc123", Frontend));
        Assert.Equal(new CacheAction(location, true), Cache.Resolve(url, "abc123", Frontend));
    }

    [Theory]
    [InlineData("http://:pass@host/", "http://:pass@host/")]
    [InlineData("https://:Z@9/", "https://:Z@0.0.0.9/")]
    public void RedirectsUrlsWithAnEmptyUserAndAPassword(string url, string location) =>
        Assert.Equal(new CacheAction(location, true), Cache.Resolve($$"""{"t":"url","v":"{{url}}"}""", "abc123", Frontend));

    [Theory]
    [InlineData("http://\u05D01.com/")]
    [InlineData("http://\u05D0_")]
    [InlineData("http://x\u05D0.com/")]
    public void TreatsHostsThatBreakIdnRulesAsNotFoundInsteadOfThrowing(string url)
    {
        Assert.Null(Cache.Resolve($$"""{"t":"url","v":"{{url}}"}""", "abc123", Frontend));
        Assert.Null(Cache.Resolve(url, "abc123", Frontend));
    }

    [Fact]
    public void ParsesTheRedisUrl()
    {
        var options = Cache.RedisOptions("redis://:s%40cret@valkey:6380/2");
        Assert.Equal(new DnsEndPoint("valkey", 6380), Assert.Single(options.EndPoints));
        Assert.Null(options.User);
        Assert.Equal("s@cret", options.Password);
        Assert.Equal(2, options.DefaultDatabase);
        Assert.False(options.Ssl);
        Assert.Same(BacklogPolicy.FailFast, options.BacklogPolicy);

        var tls = Cache.RedisOptions("rediss://user:pass@cache.example");
        Assert.Equal(new DnsEndPoint("cache.example", 6379), Assert.Single(tls.EndPoints));
        Assert.Equal("user", tls.User);
        Assert.Equal("pass", tls.Password);
        Assert.Null(tls.DefaultDatabase);
        Assert.True(tls.Ssl);
    }
}
