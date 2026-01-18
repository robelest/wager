// ═══════════════════════════════════════════════════════════════
// Discord Component Builders
// ═══════════════════════════════════════════════════════════════

// Component Types
const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
} as const;

// Button Styles
const ButtonStyle = {
  PRIMARY: 1,    // Blurple
  SECONDARY: 2,  // Gray
  SUCCESS: 3,    // Green
  DANGER: 4,     // Red
  LINK: 5,       // Gray with link
} as const;

// Text Input Styles
const TextInputStyle = {
  SHORT: 1,      // Single line
  PARAGRAPH: 2,  // Multi-line
} as const;

// ═══════════════════════════════════════════════════════════════
// Betting Components
// ═══════════════════════════════════════════════════════════════

// Standard betting buttons for wager posts
export function createBettingButtons(wagerId: string) {
  return [
    {
      type: ComponentType.ACTION_ROW,
      components: [
        {
          type: ComponentType.BUTTON,
          style: ButtonStyle.SUCCESS,
          label: "[PASS]",
          custom_id: `bet_success_${wagerId}`,
        },
        {
          type: ComponentType.BUTTON,
          style: ButtonStyle.DANGER,
          label: "[FAIL]",
          custom_id: `bet_fail_${wagerId}`,
        },
      ],
    },
    {
      type: ComponentType.ACTION_ROW,
      components: [
        {
          type: ComponentType.STRING_SELECT,
          custom_id: `bet_amount_${wagerId}`,
          placeholder: "● Bet Amount (default: 10 pts)",
          min_values: 1,
          max_values: 1,
          options: [
            { label: "5 points", value: "5", description: "Safe bet" },
            { label: "10 points", value: "10", description: "Standard bet", default: true },
            { label: "25 points", value: "25", description: "Getting serious" },
            { label: "50 points", value: "50", description: "High stakes" },
            { label: "100 points", value: "100", description: "All or nothing" },
          ],
        },
      ],
    },
  ];
}

// Simple betting buttons (without select menu, for backwards compatibility)
export function createSimpleBettingButtons(wagerId: string) {
  return [
    {
      type: ComponentType.ACTION_ROW,
      components: [
        {
          type: ComponentType.BUTTON,
          style: ButtonStyle.SUCCESS,
          label: "[PASS] 10 pts",
          custom_id: `bet_success_${wagerId}`,
        },
        {
          type: ComponentType.BUTTON,
          style: ButtonStyle.DANGER,
          label: "[FAIL] 10 pts",
          custom_id: `bet_fail_${wagerId}`,
        },
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// Modal Builders
// ═══════════════════════════════════════════════════════════════

// Bet placement modal with amount and optional trash talk
export function createBetModal(wagerId: string, prediction: "success" | "fail") {
  return {
    title: "● Place Your Bet",
    custom_id: `bet_modal_${wagerId}_${prediction}`,
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.TEXT_INPUT,
            custom_id: "amount",
            label: "Bet Amount (points)",
            style: TextInputStyle.SHORT,
            placeholder: "10",
            min_length: 1,
            max_length: 5,
            required: true,
          },
        ],
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.TEXT_INPUT,
            custom_id: "trash_talk",
            label: "Trash Talk (optional)",
            style: TextInputStyle.PARAGRAPH,
            placeholder: "Say something to the wager creator...",
            max_length: 200,
            required: false,
          },
        ],
      },
    ],
  };
}

// Custom wager creation modal
export function createWagerModal() {
  return {
    title: "▸ Create a Wager",
    custom_id: "create_wager_modal",
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.TEXT_INPUT,
            custom_id: "task",
            label: "What do you commit to doing?",
            style: TextInputStyle.PARAGRAPH,
            placeholder: "e.g., Complete 100 pushups by tonight",
            min_length: 5,
            max_length: 500,
            required: true,
          },
        ],
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.TEXT_INPUT,
            custom_id: "consequence",
            label: "What happens if you fail?",
            style: TextInputStyle.PARAGRAPH,
            placeholder: "e.g., I have to do 200 pushups tomorrow",
            min_length: 5,
            max_length: 500,
            required: true,
          },
        ],
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.TEXT_INPUT,
            custom_id: "hours",
            label: "Deadline (hours from now)",
            style: TextInputStyle.SHORT,
            placeholder: "24",
            min_length: 1,
            max_length: 4,
            required: true,
          },
        ],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// Select Menu Builders
// ═══════════════════════════════════════════════════════════════

// Bet amount select menu
export function createBetAmountSelect(wagerId: string) {
  return {
    type: ComponentType.ACTION_ROW,
    components: [
      {
        type: ComponentType.STRING_SELECT,
        custom_id: `bet_amount_${wagerId}`,
        placeholder: "● Select bet amount",
        min_values: 1,
        max_values: 1,
        options: [
          { label: "5 points", value: "5" },
          { label: "10 points", value: "10", default: true },
          { label: "25 points", value: "25" },
          { label: "50 points", value: "50" },
          { label: "100 points", value: "100" },
          { label: "Custom amount...", value: "custom" },
        ],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

// Parse custom_id to extract wager ID and action
export function parseCustomId(customId: string): {
  action: string;
  wagerId?: string;
  prediction?: "success" | "fail";
  amount?: string;
} {
  const parts = customId.split("_");

  // Handle bet_success_wagerId or bet_fail_wagerId
  if (parts[0] === "bet" && (parts[1] === "success" || parts[1] === "fail")) {
    return {
      action: "bet",
      prediction: parts[1] as "success" | "fail",
      wagerId: parts.slice(2).join("_"),
    };
  }

  // Handle bet_amount_wagerId
  if (parts[0] === "bet" && parts[1] === "amount") {
    return {
      action: "bet_amount",
      wagerId: parts.slice(2).join("_"),
    };
  }

  // Handle bet_modal_wagerId_prediction
  if (parts[0] === "bet" && parts[1] === "modal") {
    return {
      action: "bet_modal",
      wagerId: parts[2],
      prediction: parts[3] as "success" | "fail",
    };
  }

  return { action: customId };
}

// Disable buttons after interaction
export function disableComponents(components: any[]): any[] {
  return components.map((row: any) => ({
    ...row,
    components: row.components.map((comp: any) => ({
      ...comp,
      disabled: true,
    })),
  }));
}
