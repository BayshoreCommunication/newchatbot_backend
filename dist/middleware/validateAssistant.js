"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIdParam = exports.validateUpdateAssistant = exports.validateCreateAssistant = void 0;
const VALID_MODELS = [
    "gpt-4",
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
];
const validateCreateAssistant = (req, res, next) => {
    const { name, instructions, model } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Valid name is required" });
        return;
    }
    if (!instructions ||
        typeof instructions !== "string" ||
        instructions.trim().length === 0) {
        res.status(400).json({ error: "Valid instructions are required" });
        return;
    }
    if (!model || typeof model !== "string" || !VALID_MODELS.includes(model)) {
        res.status(400).json({
            error: `Valid model is required. Allowed models: ${VALID_MODELS.join(", ")}`,
        });
        return;
    }
    if (req.body.tools && !Array.isArray(req.body.tools)) {
        res.status(400).json({ error: "Tools must be an array" });
        return;
    }
    next();
};
exports.validateCreateAssistant = validateCreateAssistant;
const validateUpdateAssistant = (req, res, next) => {
    const { name, instructions, model, tools } = req.body;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
        res.status(400).json({ error: "Name must be a non-empty string" });
        return;
    }
    if (instructions !== undefined &&
        (typeof instructions !== "string" || instructions.trim().length === 0)) {
        res.status(400).json({ error: "Instructions must be a non-empty string" });
        return;
    }
    if (model !== undefined && (typeof model !== "string" || !VALID_MODELS.includes(model))) {
        res.status(400).json({
            error: `Valid model is required. Allowed models: ${VALID_MODELS.join(", ")}`,
        });
        return;
    }
    if (tools !== undefined && !Array.isArray(tools)) {
        res.status(400).json({ error: "Tools must be an array" });
        return;
    }
    next();
};
exports.validateUpdateAssistant = validateUpdateAssistant;
const validateIdParam = (req, res, next) => {
    const { id } = req.params;
    if (!id || id.length !== 24) {
        res.status(400).json({ error: "Valid MongoDB ID is required" });
        return;
    }
    next();
};
exports.validateIdParam = validateIdParam;
