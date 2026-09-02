/**
 * Compatibility module for the Codex alias. The physical /v1/responses file
 * owns its Vercel route, so the HTTP and WebSocket switch lives there.
 */
export { config, default, shouldUpgradeHostedResponses } from "./responses";
