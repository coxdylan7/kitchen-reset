import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async request => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return new Response("Authentication required", { status: 401 });
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return new Response("Authentication required", { status: 401 });
  const { booking_id: bookingId } = await request.json();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: booking } = await admin.from("bookings").select("id,price_cents,bonus_cents,worker_id,payment_status,status,worker_payout_status").eq("id", bookingId).single();
  if (!booking || booking.worker_id !== userData.user.id) return new Response("Booking not found", { status: 404 });
  if (booking.status !== "completed" || booking.payment_status !== "paid") return new Response("Booking must be paid and completed", { status: 409 });
  if (booking.worker_payout_status === "paid") return Response.json({ already_paid: true }, { headers: cors });
  const { data: worker } = await admin.from("worker_profiles").select("stripe_account_id,payouts_enabled").eq("user_id", booking.worker_id).single();
  if (!worker?.stripe_account_id || !worker.payouts_enabled) return new Response("Worker payout account is not connected", { status: 409 });
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  const transfer = await stripe.transfers.create({
    amount: Math.round((booking.price_cents + booking.bonus_cents) * 0.7),
    currency: "usd",
    destination: worker.stripe_account_id,
    metadata: { booking_id: booking.id }
  });
  await admin.from("bookings").update({ worker_payout_status: "paid", worker_payout_transfer_id: transfer.id }).eq("id", booking.id);
  return Response.json({ transfer_id: transfer.id }, { headers: cors });
});
