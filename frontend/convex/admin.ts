import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/admin";

// Site-wide admin overview: every user, every session, and roll-up totals.
// ponytail: full-table scans — fine at capstone scale; add pagination/indexes
// if the data ever grows large.
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, sessions, reports, responses] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("sessions").collect(),
      ctx.db.query("feedbackReports").collect(),
      ctx.db.query("responses").collect(),
    ]);

    const usernameById = new Map(users.map((u) => [u._id, u.username ?? "—"]));

    const reportsByUser = new Map<string, number>();
    const scoreSumByUser = new Map<string, number>();
    for (const r of reports) {
      reportsByUser.set(r.userId, (reportsByUser.get(r.userId) ?? 0) + 1);
      scoreSumByUser.set(
        r.userId,
        (scoreSumByUser.get(r.userId) ?? 0) + r.overallScore,
      );
    }
    const responsesByUser = new Map<string, number>();
    for (const r of responses) {
      responsesByUser.set(r.userId, (responsesByUser.get(r.userId) ?? 0) + 1);
    }
    const hostedByUser = new Map<string, number>();
    const reportsBySession = new Map<string, number>();
    for (const s of sessions) {
      hostedByUser.set(
        s.hostUserId,
        (hostedByUser.get(s.hostUserId) ?? 0) + 1,
      );
    }
    for (const r of reports) {
      reportsBySession.set(
        r.sessionId,
        (reportsBySession.get(r.sessionId) ?? 0) + 1,
      );
    }

    const participants = await ctx.db.query("participants").collect();
    const participantsBySession = new Map<string, number>();
    for (const p of participants) {
      participantsBySession.set(
        p.sessionId,
        (participantsBySession.get(p.sessionId) ?? 0) + 1,
      );
    }

    return {
      totals: {
        users: users.length,
        sessions: sessions.length,
        reports: reports.length,
        responses: responses.length,
      },
      users: users
        .map((u) => {
          const reportCount = reportsByUser.get(u._id) ?? 0;
          const scoreSum = scoreSumByUser.get(u._id) ?? 0;
          return {
            id: u._id,
            username: u.username ?? "—",
            email: u.email ?? "—",
            isActive: u.isActive ?? true,
            createdAt: u._creationTime,
            sessionsHosted: hostedByUser.get(u._id) ?? 0,
            responses: responsesByUser.get(u._id) ?? 0,
            reports: reportCount,
            avgScore: reportCount ? Math.round(scoreSum / reportCount) : null,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt),
      sessions: sessions
        .map((s) => ({
          id: s._id,
          code: s.code,
          mode: s.mode,
          status: s.status,
          targetRole: s.targetRole,
          topic: s.topic,
          difficulty: s.difficulty,
          questionCount: s.questionCount,
          host: usernameById.get(s.hostUserId) ?? "—",
          participants: participantsBySession.get(s._id) ?? 0,
          reports: reportsBySession.get(s._id) ?? 0,
          createdAt: s._creationTime,
        }))
        .sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

// Full detail for one session: participants, transcript, responses, reports.
export const sessionDetail = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(sessionId);
    if (!session) return null;

    const [participants, transcript, responses, reports] = await Promise.all([
      ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect(),
      ctx.db
        .query("transcript")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect(),
      ctx.db
        .query("responses")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect(),
      ctx.db
        .query("feedbackReports")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect(),
    ]);

    const host = await ctx.db.get(session.hostUserId);
    const players = await Promise.all(
      participants.map(async (p) => {
        const u = await ctx.db.get(p.userId);
        return {
          username: u?.username ?? "—",
          email: u?.email ?? "—",
          role: p.role,
          seat: p.seat,
        };
      }),
    );

    return {
      session: {
        code: session.code,
        mode: session.mode,
        status: session.status,
        targetRole: session.targetRole,
        topic: session.topic,
        difficulty: session.difficulty,
        questionCount: session.questionCount,
        host: host?.username ?? "—",
        createdAt: session._creationTime,
      },
      players,
      transcript: transcript.map((t) => ({
        kind: t.kind,
        speakerName: t.speakerName,
        speakerRole: t.speakerRole ?? null,
        text: t.text,
        competency: t.competency ?? null,
      })),
      responses: responses.map((r) => ({
        participantName: r.participantName,
        questionText: r.questionText,
        answerText: r.answerText,
        wordCount: r.wordCount,
      })),
      reports: reports.map((r) => ({
        participantName: r.participantName,
        overallScore: r.overallScore,
        competencies: r.competencies,
        strengths: r.strengths,
        improvements: r.improvements,
        summary: r.summary,
        metrics: r.metrics,
      })),
    };
  },
});
