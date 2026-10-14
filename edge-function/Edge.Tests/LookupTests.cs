using Microsoft.AspNetCore.Http;

public class LookupTests
{
    const string Frontend = "https://kurz.fyi";

    [Fact]
    public async Task ACachedUrlIsARedirectReadUnderTheShortlinkKey()
    {
        var asked = "";
        var result = await Cache.LookupAsync(
            key =>
            {
                asked = key;
                return Task.FromResult<string?>("""{"t":"url","v":"https://example.com/a"}""");
            },
            "abc123",
            Frontend);
        Assert.Equal("shortlink:abc123", asked);
        Assert.Equal(new CacheAction("https://example.com/a", true), result);
    }

    [Fact]
    public async Task AMissingKeyIsAGenuineNotFound() =>
        Assert.Null(await Cache.LookupAsync(_ => Task.FromResult<string?>(null), "nope", Frontend));

    [Theory]
    [InlineData("""{"t":"url","v":"https://example.com/\ud800"}""")]
    [InlineData("""{"t":"\ud800"}""")]
    public async Task AnUnreadableCachedValueIsNotFoundNotUnavailable(string value) =>
        Assert.Null(await Cache.LookupAsync(_ => Task.FromResult<string?>(value), "abc123", Frontend));

    [Fact]
    public async Task AUrlEntryWithDeepExtraFieldsStillRedirects()
    {
        var nested = new string('[', 200) + new string(']', 200);
        var value = """{"t":"url","v":"https://example.com/d","x":""" + nested + "}";
        Assert.Equal(new CacheAction("https://example.com/d", true), await Cache.LookupAsync(_ => Task.FromResult<string?>(value), "abc123", Frontend));
    }

    [Fact]
    public async Task AValkeyErrorIsUnavailableNotNotFound()
    {
        var boom = new InvalidOperationException("connection refused");
        Assert.Same(boom, await Assert.ThrowsAsync<InvalidOperationException>(() => Cache.LookupAsync(_ => Task.FromException<string?>(boom), "abc123", Frontend)));
    }

    [Fact]
    public async Task AHungValkeyIsUnavailableOnceTheTimeoutPasses() =>
        await Assert.ThrowsAsync<TimeoutException>(() => Cache.LookupAsync(_ => new TaskCompletionSource<string?>().Task, "abc123", Frontend, 20));

    [Fact]
    public async Task TheUnavailableResponseIsA503WithRetryAfterAndABody()
    {
        var context = new DefaultHttpContext();
        var body = new MemoryStream();
        context.Response.Body = body;

        await Cache.WriteUnavailableAsync(context);

        Assert.Equal(503, context.Response.StatusCode);
        Assert.Equal("5", context.Response.Headers.RetryAfter.ToString());
        Assert.True(body.Length > 0);
        Assert.Equal(body.Length, context.Response.ContentLength);
        Assert.Equal("text/plain; charset=utf-8", context.Response.ContentType);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }
}
