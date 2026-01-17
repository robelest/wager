import { internalAction } from "../_generated/server";
import { v } from "convex/values";

// Voice IDs for different result types
const VOICE_IDS = {
  hype: "JBFqnCBsd6RMkjVDRZzb", // Energetic voice for wins
  roast: "Xb7hH8MSUJpSbSDYk0k2", // Sassy voice for fails
};

// Generate result script based on wager outcome
export const generateResultScript = internalAction({
  args: {
    username: v.string(),
    task: v.string(),
    consequence: v.string(),
    isSuccess: v.boolean(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.isSuccess) {
      const praises = [
        `${args.username} actually did it! They said they'd ${args.task}, and they delivered. Respect.`,
        `Look at ${args.username} being all responsible and completing "${args.task}". We love to see it!`,
        `${args.username} came through! The task was "${args.task}", and they crushed it. No consequences today!`,
        `Verified! ${args.username} followed through on their wager. "${args.task}" is officially done. This is what accountability looks like.`,
        `${args.username} didn't just talk the talk, they walked the walk. "${args.task}" - complete! The streak continues.`,
      ];
      return praises[Math.floor(Math.random() * praises.length)];
    } else {
      const roasts = [
        `Oh no, ${args.username}! You said you'd "${args.task}", but where's the proof? Time for ${args.consequence}!`,
        `${args.username} fumbled the bag on "${args.task}". The community demands ${args.consequence}!`,
        `Another one bites the dust! ${args.username} couldn't deliver on "${args.task}". Consequence time: ${args.consequence}`,
        `${args.username}, buddy, you had ONE job. "${args.task}" - failed. Now everyone's waiting for ${args.consequence}. Don't disappoint us twice.`,
        `The deadline has passed, and ${args.username}'s proof for "${args.task}" is nowhere to be found. You know what that means... ${args.consequence} awaits!`,
      ];
      return roasts[Math.floor(Math.random() * roasts.length)];
    }
  },
});

// Generate audio using ElevenLabs
export const generateResultAudio = internalAction({
  args: {
    text: v.string(),
    isSuccess: v.boolean(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("ELEVENLABS_API_KEY not set");
      throw new Error("Audio generation service unavailable");
    }

    const voiceId = args.isSuccess ? VOICE_IDS.hype : VOICE_IDS.roast;

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: args.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: args.isSuccess ? 0.6 : 0.4, // More expressive for success
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("ElevenLabs error:", error);
        throw new Error("Failed to generate audio");
      }

      // Get audio as buffer
      const audioBuffer = await response.arrayBuffer();

      // Store in Convex file storage
      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const storageId = await ctx.storage.store(blob);

      return { storageId };
    } catch (error) {
      console.error("Audio generation error:", error);
      throw error;
    }
  },
});

// Get available voices (for future customization)
export const getVoices = internalAction({
  args: {},
  handler: async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { voices: [] };
    }

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": apiKey,
        },
      });

      if (!response.ok) {
        return { voices: [] };
      }

      const data = await response.json();
      return {
        voices: data.voices.map((v: any) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
        })),
      };
    } catch {
      return { voices: [] };
    }
  },
});
