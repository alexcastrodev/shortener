using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;

public static partial class Headers
{
    public static Click Click(IHeaderDictionary headers, IPAddress? remote, string shortlinkCode, DateTimeOffset now)
    {
        var userAgent = headers.UserAgent.ToString();
        var (countryCode, region) = Location(headers);
        return new Click(
            countryCode,
            region,
            DetectBrowser(userAgent),
            IpAddress(headers, remote),
            DetectPlatform(userAgent),
            Cap(headers.Referer.ToString()),
            Cap(userAgent),
            shortlinkCode,
            now.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture));
    }

    public const int MaxHeaderLength = 4096;

    static string Cap(string value) => value.Length > MaxHeaderLength ? value[..MaxHeaderLength] : value;

    public static (string? CountryCode, string? Region) Location(IHeaderDictionary headers)
    {
        var country = headers["cf-ipcountry"].ToString().Trim().ToUpperInvariant();
        var region = headers["cf-region"].ToString().Trim();
        return (country is "" or "XX" or "T1" ? null : country, region is "" ? null : region);
    }

    public static string IpAddress(IHeaderDictionary headers, IPAddress? remote)
    {
        var cfIp = headers["cf-connecting-ip"].ToString().Trim();
        if (cfIp.Length > 0) return cfIp;
        if (remote is null) return "";
        return (remote.IsIPv4MappedToIPv6 ? remote.MapToIPv4() : remote).ToString();
    }

    public static string DetectBrowser(string userAgent) =>
        EdgeRegex().IsMatch(userAgent) ? "Edge"
        : userAgent.Contains("Firefox") || userAgent.Contains("FxiOS") ? "Firefox"
        : userAgent.Contains("Chrome") || userAgent.Contains("CriOS") ? "Chrome"
        : userAgent.Contains("Safari") ? "Safari"
        : "Unknown";

    public static string DetectPlatform(string userAgent) =>
        userAgent.Contains("Android", StringComparison.OrdinalIgnoreCase) ? "Android"
        : IosRegex().IsMatch(userAgent) ? "iOS"
        : userAgent.Contains("Windows") ? "Windows"
        : userAgent.Contains("Mac OS") ? "macOS"
        : userAgent.Contains("Linux") ? "Linux"
        : "Unknown";

    [GeneratedRegex("Edg(e|A|iOS)?/")]
    private static partial Regex EdgeRegex();

    [GeneratedRegex("iPhone|iPad|iPod", RegexOptions.IgnoreCase)]
    private static partial Regex IosRegex();
}
