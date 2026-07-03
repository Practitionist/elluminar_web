// Netlify scheduled function: triggers the app's daily maintenance endpoint.
// Schedule is configured in netlify.toml.
export default async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("scheduled-maintenance: URL or CRON_SECRET missing; skipping");
    return new Response("skipped", { status: 200 });
  }
  const res = await fetch(`${base}/api/cron/maintenance`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`scheduled-maintenance: ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
