using System.Text;
using StackExchange.Redis;

if (args.Contains("--healthcheck"))
{
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
    try
    {
        using var response = await http.GetAsync("http://localhost:8000/404");
        return (int)response.StatusCode < 500 ? 0 : 1;
    }
    catch (Exception)
    {
        return 1;
    }
}

AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    Console.Error.WriteLine(e.ExceptionObject);
    Environment.Exit(1);
};

var builder = WebApplication.CreateBuilder(args);
var lenientUtf8 = new UTF8Encoding(false, false);
builder.WebHost.UseSetting(WebHostDefaults.HttpPortsKey, "8000");
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.RequestHeaderEncodingSelector = _ => lenientUtf8;
});
builder.Logging.AddFilter("Microsoft", LogLevel.Warning);
builder.Services.Configure<HostOptions>(options => options.ShutdownTimeout = TimeSpan.FromSeconds(10));
builder.Services.AddSingleton<Analytics>();
builder.Services.AddHostedService(services => services.GetRequiredService<Analytics>());

var redis = await ConnectionMultiplexer.ConnectAsync(Cache.RedisOptions(builder.Configuration.Env("REDIS_URL") ?? "redis://127.0.0.1:6379"));
builder.Services.AddSingleton<IConnectionMultiplexer>(redis);

var frontendUrl = new Uri(builder.Configuration.Env("FRONTEND_URL") ?? "https://kurz.fyi").AbsoluteUri;
var notFoundPage = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "404.html"));

var app = builder.Build();
var db = redis.GetDatabase();
var analytics = app.Services.GetRequiredService<Analytics>();

app.MapFallback("{**path}", async context =>
{
    var path = context.Request.Path.Value ?? "";
    if (path is "/" or "/404")
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.ContentLength = notFoundPage.Length;
        if (!HttpMethods.IsHead(context.Request.Method)) await context.Response.Body.WriteAsync(notFoundPage);
        return;
    }

    var key = path.Length > 1 ? path[1..] : "";
    if (key.Length == 0)
    {
        context.Response.Redirect("/404");
        return;
    }

    CacheAction? action;
    try
    {
        action = await Cache.LookupAsync(async cacheKey => await db.StringGetAsync(cacheKey), key, frontendUrl);
    }
    catch (Exception e)
    {
        app.Logger.LogError("[REDIS] Error fetching key: shortlink:{Key}: {Error}", key, e.Message);
        await Cache.WriteUnavailableAsync(context);
        return;
    }

    if (action is null)
    {
        context.Response.Redirect("/404");
        return;
    }

    if (action.Track)
        analytics.Enqueue(Headers.Click(context.Request.Headers, context.Connection.RemoteIpAddress, key, DateTimeOffset.UtcNow));
    context.Response.Redirect(action.Url);
});

await app.RunAsync();
return 0;

public partial class Program;

static class ConfigurationExtensions
{
    public static string? Env(this IConfiguration config, string key) => config[key] is { Length: > 0 } value ? value : null;
}
