/**
 * Shared OpenAI tool definitions for all Prasadam agents.
 * Each function maps to a real Firestore operation.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_available_listings",
      description: "Fetch all food listings currently available for redistribution.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_requests",
      description: "Fetch all food requests from NGOs that are still unmatched.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_match",
      description: "Create a match between an NGO request and a food listing.",
      parameters: {
        type: "object",
        required: ["requestId", "listingId", "reasoning"],
        properties: {
          requestId: { type: "string", description: "ID of the food request" },
          listingId: { type: "string", description: "ID of the food listing" },
          reasoning: { type: "string", description: "Why this is the best match" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_open_deliveries",
      description: "Fetch deliveries currently waiting for a volunteer.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_volunteer",
      description: "Assign a volunteer to a delivery.",
      parameters: {
        type: "object",
        required: ["deliveryId", "volunteerId", "reasoning"],
        properties: {
          deliveryId: { type: "string" },
          volunteerId: { type: "string" },
          reasoning: { type: "string", description: "Why this volunteer was chosen" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_escalation",
      description: "Create an escalation record for a failed workflow step.",
      parameters: {
        type: "object",
        required: ["type", "strategy", "context"],
        properties: {
          type: {
            type: "string",
            enum: ["no_restaurant_response", "volunteer_no_show", "food_expiring", "quality_fail"],
          },
          strategy: { type: "string", description: "What action to take to resolve this" },
          context: { type: "object", description: "Relevant IDs and metadata" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_notification",
      description: "Send an in-app notification to a user.",
      parameters: {
        type: "object",
        required: ["userId", "title", "body", "type"],
        properties: {
          userId: { type: "string" },
          title: { type: "string", description: "Short notification title (max 60 chars)" },
          body: { type: "string", description: "Notification body (max 160 chars)" },
          type: {
            type: "string",
            enum: ["match", "approval", "dispatch", "delivery", "escalation", "alert"],
          },
          metadata: { type: "object" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_decision",
      description: "Log an agent decision to the audit trail.",
      parameters: {
        type: "object",
        required: ["agent", "action", "reasoning"],
        properties: {
          agent: { type: "string" },
          action: { type: "string" },
          reasoning: { type: "string" },
          context: { type: "object" },
        },
      },
    },
  },
];
