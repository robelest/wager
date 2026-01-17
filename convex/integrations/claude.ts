import { internalAction } from "../_generated/server";
import { v } from "convex/values";

// Verify proof image using Claude Haiku
export const verifyProofImage = internalAction({
  args: {
    imageUrl: v.string(),
    task: v.string(),
    consequence: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not set");
      return {
        passed: false,
        confidence: 0,
        reasoning: "Verification service unavailable",
      };
    }

    try {
      // Fetch image and convert to base64
      const imageResponse = await fetch(args.imageUrl);
      if (!imageResponse.ok) {
        return {
          passed: false,
          confidence: 0,
          reasoning: "Failed to fetch proof image",
        };
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

      // Map content type to Claude's expected format
      let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
      if (contentType.includes("png")) mediaType = "image/png";
      else if (contentType.includes("gif")) mediaType = "image/gif";
      else if (contentType.includes("webp")) mediaType = "image/webp";

      // Call Claude API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
                {
                  type: "text",
                  text: `You are a wager verification agent. A user committed to the following task:

"${args.task}"

If they fail, the consequence is: "${args.consequence}"

Analyze this image and determine if it shows genuine proof of completing that task.

Consider:
- Does the image clearly show the task being completed?
- Is there enough context to verify authenticity?
- Could this be easily faked or taken out of context?

Be fair but not easily fooled. Give users the benefit of the doubt for genuine efforts, but flag obvious attempts to game the system.

Respond with ONLY valid JSON (no markdown, no explanation outside the JSON):
{
  "passed": true or false,
  "confidence": 0 to 100 (how confident you are in your assessment),
  "reasoning": "Brief explanation of your decision (1-2 sentences)"
}`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Claude API error:", error);
        return {
          passed: false,
          confidence: 0,
          reasoning: "Verification service error",
        };
      }

      const result = await response.json();
      const textContent = result.content?.find((c: any) => c.type === "text");

      if (!textContent?.text) {
        return {
          passed: false,
          confidence: 0,
          reasoning: "Failed to parse verification response",
        };
      }

      // Parse the JSON response
      try {
        const verification = JSON.parse(textContent.text);
        return {
          passed: Boolean(verification.passed),
          confidence: Number(verification.confidence) || 0,
          reasoning: String(verification.reasoning) || "No reasoning provided",
        };
      } catch {
        // Try to extract JSON from response if it has extra text
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const verification = JSON.parse(jsonMatch[0]);
          return {
            passed: Boolean(verification.passed),
            confidence: Number(verification.confidence) || 0,
            reasoning: String(verification.reasoning) || "No reasoning provided",
          };
        }
        return {
          passed: false,
          confidence: 0,
          reasoning: "Failed to parse verification response",
        };
      }
    } catch (error) {
      console.error("Verification error:", error);
      return {
        passed: false,
        confidence: 0,
        reasoning: "Verification failed due to an error",
      };
    }
  },
});
