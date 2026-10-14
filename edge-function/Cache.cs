using System.Text.Json;
using StackExchange.Redis;

public sealed record CacheAction(string Url, bool Track);

public static class Cache
{
    public const int ValkeyTimeoutMs = 2000;
    public const int RetryAfterSeconds = 5;

    static readonly byte[] UnavailableBody = "Service temporarily unavailable. Please try again shortly."u8.ToArray();

    static readonly JsonDocumentOptions JsonOptions = new() { MaxDepth = 1024 };

    public static async Task<CacheAction?> LookupAsync(Func<string, Task<string?>> get, string key, string frontendUrl, int timeoutMs = ValkeyTimeoutMs)
    {
        var value = await get("shortlink:" + key).WaitAsync(TimeSpan.FromMilliseconds(timeoutMs));
        try
        {
            return Resolve(value, key, frontendUrl);
        }
        catch (Exception e) when (e is InvalidOperationException or UriFormatException or ArgumentException or JsonException)
        {
            return null;
        }
    }

    public static async Task WriteUnavailableAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        context.Response.ContentType = "text/plain; charset=utf-8";
        context.Response.Headers.RetryAfter = RetryAfterSeconds.ToString();
        context.Response.Headers.CacheControl = "no-store";
        context.Response.ContentLength = UnavailableBody.Length;
        if (!HttpMethods.IsHead(context.Request.Method)) await context.Response.Body.WriteAsync(UnavailableBody);
    }

    public static CacheAction? Resolve(string? value, string shortCode, string frontendUrl)
    {
        if (string.IsNullOrEmpty(value)) return null;

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(value, JsonOptions);
        }
        catch (JsonException)
        {
            return HttpHref(value) is { } legacy ? new CacheAction(legacy, true) : null;
        }

        using (document)
        {
            var entry = document.RootElement;
            if (entry.ValueKind != JsonValueKind.Object
                || !entry.TryGetProperty("t", out var t)
                || t.ValueKind != JsonValueKind.String)
                return null;

            return t.GetString() switch
            {
                "url" => entry.TryGetProperty("v", out var v)
                    && v.ValueKind == JsonValueKind.String
                    && HttpHref(v.GetString()) is { } url
                        ? new CacheAction(url, true)
                        : null,
                "locked" => Uri.TryCreate(frontendUrl, UriKind.Absolute, out var frontend)
                    && Href(new Uri(frontend, "/s/" + Uri.EscapeDataString(shortCode))) is { } password
                        ? new CacheAction(password, false)
                        : null,
                _ => null,
            };
        }
    }

    public static ConfigurationOptions RedisOptions(string url)
    {
        var uri = new Uri(url);
        var userInfo = uri.UserInfo.Split(':', 2);
        return new ConfigurationOptions
        {
            EndPoints = { { uri.Host, uri.Port > 0 ? uri.Port : 6379 } },
            User = userInfo[0] is "" ? null : Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            DefaultDatabase = uri.AbsolutePath.Trim('/') is { Length: > 0 } db ? int.Parse(db) : null,
            Ssl = uri.Scheme == "rediss",
            BacklogPolicy = BacklogPolicy.FailFast,
        };
    }

    static string? HttpHref(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? Href(uri)
            : null;

    static string? Href(Uri uri)
    {
        try
        {
            return uri.Host == uri.IdnHost ? uri.AbsoluteUri : new UriBuilder(uri) { Host = uri.IdnHost }.Uri.AbsoluteUri;
        }
        catch (UriFormatException)
        {
            return null;
        }
    }
}
