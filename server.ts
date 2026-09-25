import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { polls } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import { optionalAuth } from "./src/middleware/auth.ts";

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
