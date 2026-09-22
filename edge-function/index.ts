import { connect } from "@nashaddams/amqp";
import { createClient } from "npm:redis@^4.5";
import { getHeaders } from "./headers.ts";

const RABBITMQ_HOST = Deno.env.get("RABBITMQ_HOST") ?? "127.0.0.1";
const RABBITMQ_PORT = Number(Deno.env.get("RABBITMQ_PORT") ?? 5672);
const QUEUE_NAME = "analytics";

type Connection = Awaited<ReturnType<typeof connect>>;
type Channel = Awaited<ReturnType<Connection["openChannel"]>>;

let connection: Connection | null = null;
// Shared by concurrent requests so only one connection is opened at a time.
let channelPromise: Promise<Channel> | null = null;

function resetRabbit(conn: Connection | null = connection) {
  if (conn !== connection) return;
  connection = null;
  channelPromise = null;
  conn?.close().catch(() => {});
}

function getChannel(): Promise<Channel> {
  if (channelPromise) return channelPromise;

  const attempt = (async () => {
    const conn = await connect({
      hostname: RABBITMQ_HOST,
      port: RABBITMQ_PORT,
      username: Deno.env.get("RABBITMQ_DEFAULT_USER"),
      password: Deno.env.get("RABBITMQ_DEFAULT_PASS"),
    });
    connection = conn;

    // Drop the cached connection when the broker closes it, so the next
    // publish reconnects instead of failing forever.
    conn.closed()
      .catch((err) => console.error("[AMQP] Connection lost:", err))
      .finally(() => resetRabbit(conn));

    const channel = await conn.openChannel();
    await channel.declareQueue({ queue: QUEUE_NAME, durable: true });
    console.log(`[AMQP] Connected to ${RABBITMQ_HOST}:${RABBITMQ_PORT}`);
    return channel;
  })();

  channelPromise = attempt;
  attempt.catch(() => {
    if (channelPromise === attempt) resetRabbit();
  });

  return attempt;
}

async function publishMessage(payload: Record<string, unknown>) {
  try {
    const channel = await getChannel();
    const body = new TextEncoder().encode(JSON.stringify(payload));
    await channel.publish(
      { routingKey: QUEUE_NAME },
      { contentType: "application/json" },
      body,
    );
  } catch (err) {
    console.error("[AMQP] Publish failed:", err);
    resetRabbit();
  }
}

addEventListener("unload", async () => {
  if (connection) {
    console.log("[AMQP] Closing connection...");
    await connection.close();
  }
});

const valkeyClient = await createClient({
  url: Deno.env.get("REDIS_URL"),
});

await valkeyClient.connect();

Deno.serve({ port: 8000 }, async (req, info) => {
  // serve static error pages directly to avoid redirect loops
  const url = new URL(req.url);
  const notFoundUrl = new URL("/404", req.url).href;

  if (["/404", "/"].some((path) => url.pathname === path)) {
    try {
      const body = await Deno.readTextFile(new URL("./404.html", import.meta.url));
      return new Response(body, {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch {
      return new Response("404 Not Found", { status: 404 });
    }
  }

  const key = url.pathname.substring(1);
  const cache_key = `shortlink:${key}`;

  if (key) {
    try {
      const value = await valkeyClient.get(cache_key);

      if (!value) {
        console.log(`[REDIS] Key not found: ${cache_key}`);
        return Response.redirect(notFoundUrl, 302);
      }

      getHeaders(req, info).then((payload) => {
        publishMessage({
          ...payload,
          shortlink_code: key,
          timestamp: new Date().toISOString(),
        })
        .catch((err) => console.error("[AMQP] Background publish error:", err));
      })

      return Response.redirect(value, 302);
    } catch (err) {
      console.error("[REDIS] Error fetching key:", err);
      return Response.redirect(notFoundUrl, 302);
    }
  }

  return Response.redirect(notFoundUrl, 302);
});
