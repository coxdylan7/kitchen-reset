import Stripe from "https://esm.sh/stripe@16.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async request => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = request.headers.get("Authorization");
  if (!auth) return new Response("Authentication required", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new Response("Authentication required", { status: 401 });

  const { booking_id: bookingId } = await request.json();
  if (!bookingId) return new Response("booking_id is required", { status: 400 });
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id,service_tier,price_cents,bonus_cents")
    .eq("id", bookingId)
    .eq("user_id", userData.user.id)
    .single();
  if (bookingError || !booking) return new Response("Booking not found", { status: 404 });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: userData.user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: booking.price_cents + booking.bonus_cents,
        product_data: { name: booking.service_tier }
      }
    }],
    metadata: { booking_id: booking.id },
    success_url: `${Deno.env.get("APP_URL")}/?payment=success&booking=${booking.id}`,
    cancel_url: `${Deno.env.get("APP_URL")}/?payment=cancelled&booking=${booking.id}`
  });
  return Response.json({ url: session.url }, { headers: cors });
});
