# AC: PY-04.3
# Verifies every Stripe webhook the Node example received with the official Python SDK's
# stripe.Webhook.construct_event, over the exact bytes SendMock sent.
import json
import os
import sys

import stripe

deliveries_path = os.environ.get(
    "STRIPE_DELIVERIES_PATH",
    os.path.join(os.path.dirname(__file__), "..", "stripe-deliveries.json"),
)
with open(deliveries_path, encoding="utf-8") as deliveries_file:
    delivery_file = json.load(deliveries_file)

deliveries = delivery_file.get("deliveries", [])
if not deliveries:
    sys.exit("No deliveries to verify")

verified_types = []
for delivery in deliveries:
    stripe_event = stripe.Webhook.construct_event(
        delivery["payload"],
        delivery["signature"],
        delivery_file["webhook_secret"],
    )
    verified_types.append(stripe_event["type"])

print(f"Done: the Python SDK verified {len(verified_types)} events ({', '.join(verified_types)}).")
