import express from "express";
import {
  activateFreeTrial,
  cancelSubscription,
  createCheckoutSession,
  handleWebhook,
} from "../controllers/subscriptionController";
import { authenticateJWT } from "../middleware/jwtAuth";

const router = express.Router();

// Webhook must be defined before bodyParser (if mounted here) or handled carefully.
// We will assume index.ts handles the raw body requirement or route ordering.
// However, since this is a sub-router, we can't easily control the middleware order if global middleware is already applied in index.ts.
// The best way is to mount the webhook route separately in index.ts BEFORE express.json(), OR use a raw-body-saver middleware globally.

router.post("/create-checkout-session", authenticateJWT, createCheckoutSession);
router.post("/webhook", handleWebhook);
router.post("/cancel", authenticateJWT, cancelSubscription);
router.post("/activate-trial", authenticateJWT, activateFreeTrial);

export default router;
