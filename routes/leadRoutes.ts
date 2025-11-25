import express from "express";
import {
  deleteLead,
  getLeadById,
  getLeads,
  markAsContacted,
  saveLead,
  updateLead,
} from "../controllers/leadController";

const router = express.Router();

// Save lead
router.post("/leads", saveLead);

// Get all leads (with optional filters)
router.get("/leads", getLeads);

// Get lead by ID
router.get("/leads/:id", getLeadById);

// Mark lead as contacted
router.patch("/leads/:id/contact", markAsContacted);

// Update lead
router.put("/leads/:id", updateLead);

// Delete lead
router.delete("/leads/:id", deleteLead);

export default router;
