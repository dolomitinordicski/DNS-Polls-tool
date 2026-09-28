import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { polls } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import { optionalAuth } from "./src/middleware/auth.ts";
import { GoogleGenAI, Type } from "@google/genai";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Short URL redirect
  app.get("/s/:id", (req, res) => {
    const { id } = req.params;
    res.redirect(`/?poll=${encodeURIComponent(id)}`);
  });

  // Fetch all polls
  app.get("/api/polls", optionalAuth, async (req, res) => {
    try {
      const allPolls = await db.select().from(polls);
      res.json(allPolls);
    } catch (error: any) {
      console.error("Error fetching polls from Cloud SQL:", error);
      res.status(500).json({ error: "Failed to fetch polls from database" });
    }
  });

  // Fetch single poll by ID
  app.get("/api/polls/:id", optionalAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.select().from(polls).where(eq(polls.id, id));
      if (result.length === 0) {
        return res.status(404).json({ error: "Poll not found" });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error("Error fetching poll by ID from Cloud SQL:", error);
      res.status(500).json({ error: "Failed to fetch poll" });
    }
  });

  // Create or Update a poll
  app.post("/api/polls", optionalAuth, async (req, res) => {
    try {
      const pollData = req.body;
      if (!pollData || !pollData.id || !pollData.title) {
        return res.status(400).json({ error: "Invalid poll payload" });
      }

      const valuesToInsert = {
        id: pollData.id,
        title: pollData.title,
        description: pollData.description || null,
        location: pollData.location || null,
        organizerName: pollData.organizerName,
        organizerEmail: pollData.organizerEmail || null,
        allowMaybe: pollData.allowMaybe ?? true,
        slots: pollData.slots || [],
        participants: pollData.participants || [],
        finalizedSlotId: pollData.finalizedSlotId || null,
        updatedAt: new Date(),
      };

      const result = await db
        .insert(polls)
        .values(valuesToInsert)
        .onConflictDoUpdate({
          target: polls.id,
          set: {
            title: valuesToInsert.title,
            description: valuesToInsert.description,
            location: valuesToInsert.location,
            organizerName: valuesToInsert.organizerName,
            organizerEmail: valuesToInsert.organizerEmail,
            allowMaybe: valuesToInsert.allowMaybe,
            slots: valuesToInsert.slots,
            participants: valuesToInsert.participants,
            finalizedSlotId: valuesToInsert.finalizedSlotId,
            updatedAt: valuesToInsert.updatedAt,
          },
        })
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Error saving poll to Cloud SQL:", error);
      res.status(500).json({ error: "Failed to save poll to database" });
    }
  });

  // Delete a poll
  app.delete("/api/polls/:id", optionalAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(polls).where(eq(polls.id, id));
      res.json({ success: true, id });
    } catch (error: any) {
      console.error("Error deleting poll from Cloud SQL:", error);
      res.status(500).json({ error: "Failed to delete poll" });
    }
  });

  // AI Prompt Parser: parse natural language into poll details & time slots
  app.post("/api/ai/parse-poll-prompt", async (req, res) => {
    const { prompt, lang = "it" } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];
    const todayDay = today.toLocaleDateString("en-US", { weekday: "long" });
    const currentYear = today.getFullYear();

    const systemInstruction = `You are an expert meeting planner assistant for Dolomiti NordicSki (DNS Polls).
The user provides a natural language description containing an event/meeting topic, dates, times, and possibly location or organizer.
Your task is to parse this into a structured poll specification.

Reference Context:
- Today's date is: ${todayISO} (${todayDay}).
- Current year: ${currentYear}.

Rules for Dates and Slots:
1. Extract ALL suggested dates and times.
2. Resolve relative dates (e.g. "tomorrow", "next Thursday", "prossimo martedì", "questo venerdì", "15 ottobre", "15. Oktober") to exact YYYY-MM-DD format based on today's reference date (${todayISO}). If no year is specified for an upcoming date, use ${currentYear} (or ${currentYear + 1} if that date has already passed in the current year).
3. If multiple time slots are listed for a day (e.g., "mattina 9-11 e pomeriggio 14:30-16:00", or "09:30-11:00 and 15:00-16:30"), create a distinct slot item for EACH time slot with the same date.
4. Format times consistently as "HH:MM - HH:MM" (24-hour format, e.g. "09:30 - 11:00", "14:00 - 15:30") whenever possible. If it's all day or unspecified time, use "${lang === 'de' ? 'Ganztägig' : 'Tutto il giorno'}".
5. Extract a concise, professional title for the meeting/poll.
6. Extract location (physical location like "Dobbiaco", "Cortina", "Sede", or virtual platform like "Google Meet") if mentioned.
7. Extract description/agenda notes if mentioned.
8. If the organizer's name is explicitly mentioned (e.g. "Organizzato da Marco"), extract it into organizerName; otherwise leave it as empty string.
9. allowMaybe should default to true unless the user explicitly requested only yes/no.`;

    try {
      if (process.env.GEMINI_API_KEY) {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "Clean title for the poll/meeting",
                },
                description: {
                  type: Type.STRING,
                  description: "Summary or agenda notes",
                },
                location: {
                  type: Type.STRING,
                  description: "Location or meeting link if mentioned",
                },
                organizerName: {
                  type: Type.STRING,
                  description: "Organizer name if mentioned in prompt",
                },
                allowMaybe: {
                  type: Type.BOOLEAN,
                  description: "Whether maybe votes are allowed",
                },
                slots: {
                  type: Type.ARRAY,
                  description: "List of date and time slots",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      date: {
                        type: Type.STRING,
                        description: "Date in YYYY-MM-DD format",
                      },
                      time: {
                        type: Type.STRING,
                        description: "Time range in HH:MM - HH:MM or label format",
                      },
                    },
                    required: ["date", "time"],
                  },
                },
              },
              required: ["title", "slots"],
            },
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          return res.json({ success: true, data: parsed, source: "gemini" });
        }
      }
    } catch (geminiError: any) {
      console.warn("Gemini prompt parsing error, falling back to heuristic extraction:", geminiError?.message);
    }

    // Heuristic fallback in case Gemini API is not reachable or without key
    const fallbackSlots: Array<{ date: string; time: string }> = [];
    const monthMap: Record<string, string> = {
      gennaio: "01", gennaio_: "01", januar: "01", jan: "01",
      febbraio: "02", februar: "02", feb: "02",
      marzo: "03", märz: "03", maerz: "03", mar: "03",
      aprile: "04", april: "04", apr: "04",
      maggio: "05", mai: "05", may: "05",
      giugno: "06", juni: "06", jun: "06",
      luglio: "07", juli: "07", jul: "07",
      agosto: "08", august: "08", aug: "08",
      settembre: "09", september: "09", sep: "09", sett: "09",
      ottobre: "10", oktober: "10", okt: "10", ott: "10",
      novembre: "11", november: "11", nov: "11",
      dicembre: "12", dezember: "12", dez: "12", dic: "12",
    };

    // Extract spelled-out dates like "15 ottobre" or "15. Oktober"
    const textDateRegex = /\b(\d{1,2})\b\s*(?:[°.]|\s+di|\s+de)?\s+([a-zA-ZäöüÄÖÜ]{3,12})\b(?:\s+(\d{4}))?/gi;
    let textMatch;
    while ((textMatch = textDateRegex.exec(prompt)) !== null) {
      const day = textMatch[1].padStart(2, "0");
      const monthRaw = textMatch[2].toLowerCase();
      if (monthMap[monthRaw]) {
        const month = monthMap[monthRaw];
        const year = textMatch[3] ? textMatch[3] : `${currentYear}`;
        fallbackSlots.push({
          date: `${year}-${month}-${day}`,
          time: "09:30 - 11:00",
        });
      }
    }

    // Numerical date fallback (15/10/2026 or 15.10.2026)
    if (fallbackSlots.length === 0) {
      const dateRegex = /(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?/g;
      let match;
      while ((match = dateRegex.exec(prompt)) !== null) {
        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
        const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : `${currentYear}`;
        fallbackSlots.push({
          date: `${year}-${month}-${day}`,
          time: "09:30 - 11:00",
        });
      }
    }

    // Extract times if mentioned (e.g. "9:00 alle 11:00" or "14:30 - 16:00")
    const timeRanges: string[] = [];
    const timeRegex = /(\d{1,2}(?::\d{2})?)\s*(?:-|alle|bis|to)\s*(\d{1,2}(?::\d{2})?)/gi;
    let tMatch;
    while ((tMatch = timeRegex.exec(prompt)) !== null) {
      let t1 = tMatch[1].trim();
      let t2 = tMatch[2].trim();
      if (!t1.includes(":")) t1 = `${t1.padStart(2, "0")}:00`;
      else t1 = t1.padStart(5, "0");
      if (!t2.includes(":")) t2 = `${t2.padStart(2, "0")}:00`;
      else t2 = t2.padStart(5, "0");
      timeRanges.push(`${t1} - ${t2}`);
    }

    if (timeRanges.length > 0 && fallbackSlots.length > 0) {
      fallbackSlots.forEach((slot, i) => {
        slot.time = timeRanges[i % timeRanges.length];
      });
    }

    // Default dates if nothing found
    if (fallbackSlots.length === 0) {
      const d1 = new Date();
      d1.setDate(d1.getDate() + 2);
      const d2 = new Date();
      d2.setDate(d2.getDate() + 3);
      fallbackSlots.push(
        { date: d1.toISOString().split("T")[0], time: timeRanges[0] || "09:30 - 11:00" },
        { date: d2.toISOString().split("T")[0], time: timeRanges[1] || "14:30 - 16:00" }
      );
    }

    // Extract simple title
    let cleanTitle = prompt.split(/[:\n\.\?]/)[0].trim();
    if (cleanTitle.length > 60) cleanTitle = cleanTitle.substring(0, 60);

    // Extract location if mentioned
    let detectedLocation = "";
    const locMatch = /(?:a|in|presso|sede|bei)\s+([A-ZÀ-ÖØ-öø-ÿ][a-zA-ZÀ-ÖØ-öø-ÿ0-9\s]{2,20})/i.exec(prompt);
    if (locMatch && !["il", "la", "le", "i", "un", "una", "der", "die", "das", "den"].includes(locMatch[1].toLowerCase().trim())) {
      detectedLocation = locMatch[1].trim();
    }

    return res.json({
      success: true,
      data: {
        title: cleanTitle || (lang === "de" ? "Neue Terminumfrage" : "Nuova Riunione"),
        description: prompt.trim(),
        location: detectedLocation,
        organizerName: "",
        allowMaybe: true,
        slots: fallbackSlots,
      },
      source: "fallback",
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: any) => {
    console.error("Server listener error:", err);
  });
}

startServer().catch((err) => {
  console.error("Fatal server startup error:", err);
});
