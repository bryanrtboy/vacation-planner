import { NextResponse } from "next/server";
import {
  listDestinationVoteState,
  normalizeDestinationVoteUserName,
  updateDestinationVote,
  type DestinationVoteAction
} from "@/lib/storage/destination-vote-store";

export const runtime = "nodejs";

const validActions = new Set<DestinationVoteAction>(["star", "unstar", "hide", "unhide"]);

export async function GET() {
  return NextResponse.json(await listDestinationVoteState());
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    destinationSlug?: string;
    userName?: string;
    action?: DestinationVoteAction;
  } | null;

  const destinationSlug = body?.destinationSlug?.trim();
  const userName = normalizeDestinationVoteUserName(body?.userName);
  const action = body?.action;

  if (!destinationSlug || !userName || !action || !validActions.has(action)) {
    return NextResponse.json(
      {
        ...(await listDestinationVoteState()),
        message: "Destination, display name, and vote action are required."
      },
      { status: 400 }
    );
  }

  const saved = await updateDestinationVote(destinationSlug, userName, action);

  return NextResponse.json({
    ...(await listDestinationVoteState()),
    message: saved ? "Destination preference updated." : "Unable to update destination preference."
  });
}
