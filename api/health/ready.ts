import { hostedHealthPayload } from "../../lib/hosted-health";

type Response = { status(code: number): Response; json(payload: unknown): void };

export default function handler(_request: unknown, response: Response): void {
  response.status(200).json(hostedHealthPayload("ready"));
}
