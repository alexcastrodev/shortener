// deno run --allow-net main.ts
import { type Channel, connect, type Connection } from "@nashaddams/amqp";
import { createClient } from "npm:redis@^4.5";
import { getHeaders } from "./headers.ts";

const RABBITMQ_HOST = Deno.env.get("RABBITMQ_HOST") ?? "127.0.0.1";
const RABBITMQ_PORT = Number(Deno.env.get("RABBITMQ_PORT") ?? 5672);
const QUEUE_NAME = "analytics";

let connection: Connection | null = null;
let channel: Channel | null = null;

async function setupRabbit() {
  if (connection && channel) return;
  connection = await connect({
    hostname: RABBITMQ_HOST,
    port: RABBITMQ_PORT,
    username: Deno.env.get("RABBITMQ_DEFAULT_USER"),
    password: Deno.env.get("RABBITMQ_DEFAULT_PASS"),
  });
  channel = await connection.openChannel();
  await channel.declareQueue({ queue: QUEUE_NAME, durable: true });
  console.log(`[AMQP] Connected to ${RABBITMQ_HOST}:${RABBITMQ_PORT}`);
}

async function publishMessage(payload: Record<string, unknown>) {
  try {
    await setupRabbit();
    const body = new TextEncoder().encode(JSON.stringify(payload));
    await channel!.publish(
      { routingKey: QUEUE_NAME },
      { contentType: "application/json" },
      body,
    );
  } catch (err) {
    console.error("[AMQP] Publish failed:", err);
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
  const url = new URL(req.url);
  const key = url.pathname.substring(1);
  const cache_key = `shortlink:${key}`;
  if (key) {
    try {
      const value = await valkeyClient.get(cache_key);

      if (!value) {
        return Response.redirect("/404", 302);
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
    } catch {
      return Response.redirect("/500", 302);
    }
  }

  return Response.redirect("/404", 302);
});
