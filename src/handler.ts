import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import {
  getPredictions,
  error_response,
  success_response,
  extractValues,
  getOutcomes,
  getStatistics,
  validUUID,
  validateData,
  getDates,
  JWT,
  userExists,
} from "./utils";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const head = event.headers;
    if (!head || !Object.keys(head).includes("Authorization"))
      return error_response("Not Authorized");
    const token = JWT(head.Authorization);
    const user = await userExists(token.email);
    if (!user) return error_response("User does not exists");

    const from = event.queryStringParameters?.from;
    const to = event.queryStringParameters?.to;

    const dates = getDates(from, to);

    const pred_rows = await getPredictions(user, dates);
    const predictions = validateData(pred_rows);

    const out_rows = await getOutcomes(predictions);
    const outcomes = validateData(out_rows);

    const results = getStatistics(outcomes, predictions);

    return success_response(results);
  } catch (error: any) {
    return error_response("Error: " + error.message);
  }
}
