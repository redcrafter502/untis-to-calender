import { AccessById, QUERIES } from "@/db/queries";
import { getUntis } from "@/lib/untis";
import ical from "ical-generator";
import { getExamCalEvents, getLessonCalEvents } from "@/lib/cal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await QUERIES.getAccessById(id);
  if (data.isErr()) return new Response("Access not found", { status: 404 });
  const untis = getUntis({
    url: data.value.domain,
    school: data.value.school,
    timezone: data.value.timezone,
    auth: getAuth(data.value),
  });
  const session = await untis.login();
  if (session.isErr())
    return new Response("Login to Untis failed", { status: 500 });

  const calendar = ical({ name: data.value.name });

  if (data.value.authType === "password" || data.value.authType === "secret") {
    const exams = await untis.getExamsForCurrentSchoolyear(session.value);
    if (exams.isErr()) {
      calendar.createEvent({
        start: new Date(),
        end: new Date(),
        summary: "Failed to get exams",
      });
    } else {
      getExamCalEvents(exams.value).forEach((event) => {
        if (!event) return;
        calendar.createEvent(event);
      });
    }
  }

  const { startOfCurrentWeek, endOfNextWeek } = getCurrentAndNextWeekRange();
  const lessons = await untis.getTimetableWithHomework(
    startOfCurrentWeek,
    endOfNextWeek,
    session.value,
  );
  if (lessons.isErr()) {
    calendar.createEvent({
      start: new Date(),
      end: new Date(),
      summary: "Failed to get lessons",
    });
  } else {
    getLessonCalEvents(lessons.value).forEach((event) => {
      if (!event) return;
      calendar.createEvent(event);
    });
  }

  await untis.logout(session.value);

  return new Response(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.value.name}.ics"`,
    },
  });
}

function getAuth(access: AccessById):
  | {
      type: "public";
      classId: number;
    }
  | {
      type: "password";
      username: string;
      password: string;
    }
  | {
      type: "secret";
      username: string;
      secret: string;
    } {
  switch (access.authType) {
    case "public":
      return { type: "public", classId: access.classId };
    case "password":
      return {
        type: "password",
        username: access.username,
        password: access.password,
      };
    case "secret":
      return {
        type: "secret",
        username: access.username,
        secret: access.secret,
      };
  }
}

function getCurrentAndNextWeekRange() {
  const now = new Date();

  // Calculate the start of the current week (Monday)
  const startOfCurrentWeek = new Date(now);
  startOfCurrentWeek.setDate(now.getDate() - now.getDay() + 1); // Monday

  // Calculate the end of the next week (Sunday)
  const endOfNextWeek = new Date(startOfCurrentWeek);
  endOfNextWeek.setDate(startOfCurrentWeek.getDate() + 13); // Next week's Sunday

  return { startOfCurrentWeek, endOfNextWeek };
}
