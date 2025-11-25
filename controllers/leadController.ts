import { Request, Response } from "express";
import Lead from "../models/Lead";

// Save lead
export const saveLead = async (req: Request, res: Response) => {
  try {
    const {
      name,
      phone,
      email,
      assistantId,
      threadId,
      incidentType,
      conversationSummary,
    } = req.body;

    const lead = new Lead({
      name,
      phone,
      email,
      assistantId,
      threadId,
      incidentType,
      conversationSummary,
    });

    await lead.save();

    res.status(201).json({
      message: "Lead saved successfully",
      data: lead,
    });
  } catch (error: any) {
    console.error("Error saving lead:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all leads
export const getLeads = async (req: Request, res: Response) => {
  try {
    const { contacted, assistantId, limit = 50, page = 1 } = req.query;

    const filter: any = {};
    if (contacted !== undefined) {
      filter.contacted = contacted === "true";
    }
    if (assistantId) {
      filter.assistantId = assistantId;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const leads = await Lead.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Lead.countDocuments(filter);

    res.json({
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get lead by ID
export const getLeadById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id);

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({
      data: lead,
    });
  } catch (error: any) {
    console.error("Error fetching lead:", error);
    res.status(500).json({ error: error.message });
  }
};

// Mark lead as contacted
export const markAsContacted = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const updateData: any = { contacted: true };
    if (notes) {
      updateData.notes = notes;
    }

    const lead = await Lead.findByIdAndUpdate(id, updateData, { new: true });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({
      message: "Lead marked as contacted",
      data: lead,
    });
  } catch (error: any) {
    console.error("Error marking lead as contacted:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update lead
export const updateLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const lead = await Lead.findByIdAndUpdate(id, updateData, { new: true });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error: any) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete lead
export const deleteLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findByIdAndDelete(id);

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({
      message: "Lead deleted successfully",
      data: lead,
    });
  } catch (error: any) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: error.message });
  }
};
