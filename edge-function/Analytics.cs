using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using RabbitMQ.Client;

public sealed record Click(
    string? CountryCode,
    string? Region,
    string Browser,
    string IpAddress,
    string Platform,
    string Referer,
    string UserAgent,
    string ShortlinkCode,
    string Timestamp);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
[JsonSerializable(typeof(Click))]
public partial class ClickJson : JsonSerializerContext;

public sealed class Analytics(IConfiguration config, ILogger<Analytics> logger) : BackgroundService
{
    const string Queue = "analytics";

    static readonly BasicProperties Properties = new() { ContentType = "application/json" };

    readonly Channel<Click> clicks = Channel.CreateBounded<Click>(
        new BoundedChannelOptions(10_000) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });

    readonly ConnectionFactory factory = new()
    {
        HostName = config.Env("RABBITMQ_HOST") ?? "127.0.0.1",
        Port = int.Parse(config.Env("RABBITMQ_PORT") ?? "5672"),
        UserName = config.Env("RABBITMQ_DEFAULT_USER") ?? ConnectionFactory.DefaultUser,
        Password = config.Env("RABBITMQ_DEFAULT_PASS") ?? ConnectionFactory.DefaultPass,
        AutomaticRecoveryEnabled = true,
    };

    IConnection? connection;

    public bool Enqueue(Click click) => clicks.Writer.TryWrite(click);

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        clicks.Writer.TryComplete();
        return base.StopAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        IChannel? channel = null;
        try
        {
            await foreach (var click in clicks.Reader.ReadAllAsync(CancellationToken.None))
            {
                channel ??= await OpenChannelAsync(stoppingToken);
                if (channel is null) break;

                try
                {
                    await channel.BasicPublishAsync("", Queue, false, Properties, JsonSerializer.SerializeToUtf8Bytes(click, ClickJson.Default.Click));
                }
                catch (Exception e)
                {
                    logger.LogWarning("[AMQP] Publish failed: {Error}", e.Message);
                    if (channel.IsClosed && connection is { IsOpen: true }) channel = null;
                }
            }
        }
        finally
        {
            if (connection is not null) await connection.DisposeAsync();
        }
    }

    async Task<IChannel?> OpenChannelAsync(CancellationToken stoppingToken)
    {
        for (var delay = TimeSpan.FromSeconds(1); ; delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30)))
        {
            try
            {
                connection ??= await factory.CreateConnectionAsync(stoppingToken);
                var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);
                await channel.QueueDeclareAsync(Queue, durable: true, exclusive: false, autoDelete: false, arguments: null, cancellationToken: stoppingToken);
                logger.LogInformation("[AMQP] Connected to {Host}:{Port}", factory.HostName, factory.Port);
                return channel;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return null;
            }
            catch (Exception e)
            {
                logger.LogWarning("[AMQP] Connection to {Host}:{Port} failed, retrying in {Delay}: {Error}", factory.HostName, factory.Port, delay, e.Message);
            }

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return null;
            }
        }
    }
}
