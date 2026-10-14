using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;

public sealed class ValkeyProxy : IAsyncDisposable
{
    enum Mode { Forward, Refuse, Hang }

    readonly TcpListener listener = new(IPAddress.Loopback, 0);
    readonly string upstreamHost;
    readonly int upstreamPort;
    readonly ConcurrentDictionary<TcpClient, bool> sockets = new();
    readonly CancellationTokenSource stop = new();
    readonly Task accepting;
    volatile Mode mode = Mode.Forward;

    public ValkeyProxy(string upstreamHost, int upstreamPort)
    {
        this.upstreamHost = upstreamHost;
        this.upstreamPort = upstreamPort;
        listener.Start();
        accepting = AcceptAsync();
    }

    public int Port => ((IPEndPoint)listener.LocalEndpoint).Port;

    public void Forward() => Reset(Mode.Forward);

    public void Refuse() => Reset(Mode.Refuse);

    public void Hang() => mode = Mode.Hang;

    void Reset(Mode next)
    {
        mode = next;
        foreach (var socket in sockets.Keys) socket.Dispose();
        sockets.Clear();
    }

    async Task AcceptAsync()
    {
        try
        {
            while (true)
            {
                var client = await listener.AcceptTcpClientAsync(stop.Token);
                if (mode == Mode.Refuse)
                {
                    client.Dispose();
                    continue;
                }

                var server = new TcpClient();
                await server.ConnectAsync(upstreamHost, upstreamPort, stop.Token);
                sockets[client] = true;
                sockets[server] = true;
                _ = PumpAsync(client, server);
                _ = PumpAsync(server, client);
            }
        }
        catch (Exception) when (stop.IsCancellationRequested)
        {
        }
    }

    async Task PumpAsync(TcpClient from, TcpClient to)
    {
        var buffer = new byte[16 * 1024];
        try
        {
            int read;
            while ((read = await from.GetStream().ReadAsync(buffer, stop.Token)) > 0)
                if (mode == Mode.Forward) await to.GetStream().WriteAsync(buffer.AsMemory(0, read), stop.Token);
        }
        catch (Exception)
        {
        }
        finally
        {
            from.Dispose();
            to.Dispose();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await stop.CancelAsync();
        listener.Stop();
        Reset(Mode.Refuse);
        await accepting;
        stop.Dispose();
    }
}
