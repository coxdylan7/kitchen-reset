import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async request => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return new Response("Authentication required", { status: 401 });
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
  const { data } = await userClient.auth.getUser();
  if (!data.user) return new Response("Authentication required", { status: 401 });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("worker_profiles").select("stripe_account_id").eq("user_id", data.user.id).single();
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  const accountId = profile?.stripe_account_id || (await stripe.accounts.create({ type: "express", email: data.user.email })).id;
  await admin.from("worker_profiles").update({ stripe_account_id: accountId }).eq("user_id", data.user.id);
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${Deno.env.get("APP_URL")}/?payout=retry`,
    return_url: `${Deno.env.get("APP_URL")}/?payout=connected`,
    type: "account_onboarding"
  });
  return Response.json({ url: link.url }, { headers: cors });
});
