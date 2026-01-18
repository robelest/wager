// ═══════════════════════════════════════════════════════════════
// Discord Embed Builders - Matched to Website Theme
// ═══════════════════════════════════════════════════════════════

// Brand colors - MATCHED TO WEBSITE THEME (src/styles/app.css)
export const COLORS = {
  PRIMARY: 0x1a8a8a,    // Rich teal (website primary) - default/active wagers
  SECONDARY: 0x3a3d52,  // Deep slate - secondary elements
  ACCENT: 0xd9a857,     // Warm amber - points/highlights/leaderboard
  SUCCESS: 0x1ea664,    // Green - completed wagers
  DANGER: 0xc43a34,     // Red - failed wagers
  WARNING: 0xe5b955,    // Yellow/amber - pending/proof
} as const;

// Status symbols - minimal Unicode for clean look
export const STATUS_EMOJI = {
  active: "▸",
  completed: "✓",
  failed: "✗",
  pending: "○",
  verified: "◆",
  points: "●",
  trophy: "★",
} as const;

// Medal symbols for rankings
const MEDALS = ["①", "②", "③"] as const;

// Visual progress bar using emoji
export function createProgressBar(percent: number, length = 10): string {
  const filled = Math.round(percent / (100 / length));
  const empty = length - filled;
  return "▓".repeat(filled) + "░".repeat(empty) + ` ${Math.round(percent)}%`;
}

// Get medal or rank number
export function getRankEmoji(index: number): string {
  return MEDALS[index] || `\`${index + 1}.\``;
}

// ═══════════════════════════════════════════════════════════════
// Wager Embed - New wager announcement
// ═══════════════════════════════════════════════════════════════
export function createWagerEmbed(
  username: string,
  avatarUrl: string | null,
  task: string,
  consequence: string,
  deadline: number,
  wagerId: string
) {
  const deadlineSeconds = Math.floor(deadline / 1000);

  return {
    color: COLORS.PRIMARY,
    author: {
      name: `${username}'s Wager`,
      icon_url: avatarUrl || undefined,
    },
    title: `${STATUS_EMOJI.active} NEW PUBLIC WAGER`,
    description: `**${task}**`,
    thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
    fields: [
      {
        name: `${STATUS_EMOJI.failed} If I Fail`,
        value: `\`\`\`${consequence}\`\`\``,
        inline: false,
      },
      {
        name: "◷ Deadline",
        value: `<t:${deadlineSeconds}:F>\n(<t:${deadlineSeconds}:R>)`,
        inline: false,
      },
    ],
    footer: {
      text: `Wager #${wagerId.slice(-6)}`,
    },
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// Result Embed - Wager completion/failure announcement
// ═══════════════════════════════════════════════════════════════
export function createResultEmbed(
  username: string,
  avatarUrl: string | null,
  task: string,
  passed: boolean,
  reasoning: string,
  confidence?: number,
  totalPool?: number,
  proofUrl?: string | null
) {
  const embed: Record<string, any> = {
    color: passed ? COLORS.SUCCESS : COLORS.DANGER,
    author: {
      name: `${username} - ${passed ? STATUS_EMOJI.trophy + " COMPLETED!" : STATUS_EMOJI.failed + " FAILED!"}`,
      icon_url: avatarUrl || undefined,
    },
    title: task,
    description: passed
      ? "> *They actually did it! Respect.*"
      : "> *Time for consequences... no excuses.*",
    fields: [
      {
        name: `${STATUS_EMOJI.verified} AI Verification`,
        value: reasoning.length > 200 ? `\`\`\`${reasoning.slice(0, 200)}...\`\`\`` : `\`\`\`${reasoning}\`\`\``,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  // Add confidence if available
  if (confidence !== undefined) {
    embed.fields.push({
      name: "▪ Confidence",
      value: createProgressBar(confidence),
      inline: true,
    });
  }

  // Add pool info if available
  if (totalPool !== undefined && totalPool > 0) {
    embed.fields.push({
      name: `${STATUS_EMOJI.points} Pool Distributed`,
      value: `${totalPool.toLocaleString()} pts`,
      inline: true,
    });
  }

  // Add proof image if available and passed
  if (passed && proofUrl) {
    embed.image = { url: proofUrl };
  }

  return embed;
}

// ═══════════════════════════════════════════════════════════════
// Proof Submitted Embed
// ═══════════════════════════════════════════════════════════════
export function createProofEmbed(
  username: string,
  avatarUrl: string | null,
  task: string,
  proofUrl: string,
  deadline: number,
  wagerId: string
) {
  const deadlineSeconds = Math.floor(deadline / 1000);

  return {
    color: COLORS.WARNING,
    title: "▫ PROOF SUBMITTED",
    author: {
      name: username,
      icon_url: avatarUrl || undefined,
    },
    description: `Proof submitted for: **${task}**`,
    image: {
      url: proofUrl,
    },
    fields: [
      {
        name: "Status",
        value: `${STATUS_EMOJI.verified} AI verification in progress...`,
        inline: true,
      },
      {
        name: "Deadline",
        value: `<t:${deadlineSeconds}:R>`,
        inline: true,
      },
    ],
    footer: { text: `Wager #${wagerId.slice(-6)}` },
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// Leaderboard Embed
// ═══════════════════════════════════════════════════════════════
interface LeaderboardUser {
  discordId: string;
  completedWagers?: number;
  totalWagers?: number;
  completionRate?: number;
  totalWinnings?: number;
}

export function createLeaderboardEmbed(
  mostReliable: LeaderboardUser[],
  topBettors?: LeaderboardUser[]
) {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  // Most Reliable
  if (mostReliable.length > 0) {
    fields.push({
      name: "◈ Most Reliable",
      value: mostReliable
        .slice(0, 5)
        .map((u, i) => {
          const rate = u.completionRate !== undefined
            ? Math.round(u.completionRate * 100)
            : (u.totalWagers ? Math.round((u.completedWagers || 0) / u.totalWagers * 100) : 0);
          return `${getRankEmoji(i)} <@${u.discordId}>\n╰ ${u.completedWagers || 0}/${u.totalWagers || 0} • ${createProgressBar(rate, 6)}`;
        })
        .join("\n") || "No data yet",
      inline: true,
    });
  }

  // Top Bettors (optional)
  if (topBettors && topBettors.length > 0) {
    fields.push({
      name: `${STATUS_EMOJI.points} Top Bettors`,
      value: topBettors
        .slice(0, 5)
        .map((u, i) => {
          return `${getRankEmoji(i)} <@${u.discordId}>\n╰ +${(u.totalWinnings || 0).toLocaleString()} pts won`;
        })
        .join("\n") || "No data yet",
      inline: true,
    });
  }

  return {
    color: COLORS.ACCENT,
    title: `${STATUS_EMOJI.trophy} SERVER LEADERBOARD`,
    fields,
    footer: {
      text: "Use /wager to join the competition!",
    },
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// My Wagers Embed (ephemeral)
// ═══════════════════════════════════════════════════════════════
interface WagerSummary {
  task: string;
  deadline: number;
  status: "active" | "completed" | "failed";
}

export function createMyWagersEmbed(wagers: WagerSummary[]) {
  if (wagers.length === 0) {
    return {
      color: COLORS.SECONDARY,
      title: "Your Wagers",
      description: "You have no active wagers. Create one with `/wager`!",
    };
  }

  return {
    color: COLORS.PRIMARY,
    title: `${STATUS_EMOJI.active} Your Active Wagers`,
    description: wagers
      .map((w, i) => {
        const emoji = STATUS_EMOJI[w.status] || STATUS_EMOJI.active;
        const deadlineSeconds = Math.floor(w.deadline / 1000);
        return `**${i + 1}.** ${emoji} ${w.task}\n   ◷ <t:${deadlineSeconds}:R>`;
      })
      .join("\n\n"),
    footer: {
      text: `${wagers.length} active wager${wagers.length > 1 ? "s" : ""}`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Bet Confirmation Embed (ephemeral)
// ═══════════════════════════════════════════════════════════════
export function createBetConfirmationEmbed(
  prediction: "success" | "fail",
  amount: number,
  remainingPoints: number
) {
  const symbol = prediction === "success" ? "✓" : "✗";
  const predictionText = prediction === "success" ? "they'll succeed" : "they'll fail";

  return {
    color: prediction === "success" ? COLORS.SUCCESS : COLORS.DANGER,
    title: `${symbol} Bet Placed!`,
    description: `You wagered **${amount} points** that ${predictionText}.`,
    fields: [
      {
        name: `${STATUS_EMOJI.points} Remaining Balance`,
        value: `**${remainingPoints.toLocaleString()} points**`,
        inline: true,
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// Reward Embed
// ═══════════════════════════════════════════════════════════════
export function createRewardEmbed(
  recipientId: string,
  amount: number,
  reason: string,
  newBalance: number,
  issuerId: string
) {
  const isPositive = amount > 0;
  const symbol = isPositive ? "+" : "−";
  const action = isPositive ? "awarded to" : "deducted from";
  const absAmount = Math.abs(amount);

  return {
    color: isPositive ? COLORS.SUCCESS : COLORS.DANGER,
    title: `${symbol} Points ${isPositive ? "Awarded" : "Deducted"}`,
    description: `**${absAmount} points** ${action} <@${recipientId}>`,
    fields: [
      {
        name: "▪ Reason",
        value: reason,
        inline: false,
      },
      {
        name: `${STATUS_EMOJI.points} New Balance`,
        value: `**${newBalance.toLocaleString()} points**`,
        inline: true,
      },
      {
        name: "▫ Issued By",
        value: `<@${issuerId}>`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}
