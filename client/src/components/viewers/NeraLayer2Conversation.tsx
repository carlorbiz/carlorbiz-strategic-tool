import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Send, ArrowLeft, Sparkles, MessageSquare, ChevronRight } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationConfig {
  id: string;
  title: string;
  starter: string;
  neraOpener: string;
  label: string;
  branches: Record<string, BranchConfig>;
}

interface BranchConfig {
  label: string;
  followUps: string[];
  focus: string;
}

interface InsightCard {
  coreTension: string;
  organisationalSignal: string;
  keyInsight: string;
  questionToSitWith: string;
  possibleNextStep: string;
  service: string;
  serviceUrl: string;
}

type Phase = 'select' | 'conversation' | 'extracting' | 'insight' | 'error';

// ─── Conversation configurations ────────────────────────────────

const CONVERSATIONS: ConversationConfig[] = [
  {
    id: 'strategic-direction',
    title: 'Strategic Direction',
    starter: "We're at a crossroads and I'm not sure which direction to take.",
    neraOpener:
      "That sounds like a significant moment. Before we explore the options themselves — when you imagine the right decision being made, what does it allow your organisation to do that it can't do right now?",
    label: '"We\'re at a crossroads"',
    branches: {
      A: {
        label: 'Mission / Impact',
        followUps: [
          "What's at stake if the wrong direction is chosen — not for the budget, but for the people you exist to serve?",
          "Who needs to be part of this decision and currently isn't in the room?",
        ],
        focus:
          'Values alignment, long-term sustainability, whether the crossroads is about direction or courage',
      },
      B: {
        label: 'Operational / Resource',
        followUps: [
          "What would need to be true for the team to genuinely back this — not just comply, but commit?",
          "What's been tried before, and what did it teach you about what the organisation can actually absorb?",
        ],
        focus:
          'Capacity and readiness signals, what the constraint is protecting, resource vs prioritisation',
      },
      C: {
        label: 'Uncertainty / Anxiety',
        followUps: [
          "If this decision were completely reversible — no consequences — what would you do tomorrow?",
          "What would agreement actually look like in practice? Not consensus — but enough alignment to move.",
        ],
        focus:
          'Information gaps, leadership misalignment, fear of downstream consequences',
      },
    },
  },
  {
    id: 'people-culture',
    title: 'People & Culture',
    starter: "Something's not working in my team and I can't quite put my finger on it.",
    neraOpener:
      "That instinct matters — leaders often sense something before they can name it. Is this more about how your team works together, or how individuals are showing up?",
    label: '"Something\'s not working"',
    branches: {
      A: {
        label: 'Collaboration',
        followUps: [
          "When the team was working well — and I'm guessing there was a time — what did that look like? What was different?",
          "If you could change one thing about how decisions get made in your team, what would it be?",
        ],
        focus:
          'Decision-making, psychological safety, structural vs relational issues',
      },
      B: {
        label: 'Individuals',
        followUps: [
          "Have you had the direct conversation with them about what you're seeing? And if not — what's made that hard?",
          "What shifted? Was there a specific moment, or has it been a gradual drift?",
        ],
        focus: 'Role clarity, what has shifted recently, motivation vs capacity',
      },
      C: {
        label: 'Both / Entangled',
        followUps: [
          "Can you think of one specific recent moment that crystallised this concern? Something that happened in a meeting, or a conversation, or even an email?",
          "If someone new joined the team tomorrow, what would they notice first about the culture?",
        ],
        focus:
          'Ask for a crystallising incident, then branch from what it reveals',
      },
    },
  },
  {
    id: 'impact-evidence',
    title: 'Impact & Evidence',
    starter: "I struggle to show our funders and board what we're actually achieving.",
    neraOpener:
      "This is one of the most persistent frustrations in your sector. When your funders look at your current reports, what do you think they're missing that you know to be true?",
    label: '"I can\'t show what we achieve"',
    branches: {
      A: {
        label: 'Stories / Qualitative',
        followUps: [
          "Which funder relationship feels most fragile right now — and what would shift it?",
          "If you could sit a funder down and show them one story that would change their understanding of your work, what would it be?",
        ],
        focus:
          'Story capture, beneficiary voice, what proof looks like for different audiences',
      },
      B: {
        label: 'Attribution / Complexity',
        followUps: [
          "What do you believe are the actual mechanisms of change in your work — the things that make it work, even if you can't prove causation?",
          "Have your funders ever discussed what realistic evidence standards look like for the kind of change you're trying to create?",
        ],
        focus:
          'Theory of change, contribution vs attribution, whether measuring the right things',
      },
      C: {
        label: 'Governance / Trust',
        followUps: [
          "When was the last time a report you submitted actually changed a decision your board made?",
          "What's your organisation's relationship with evaluation historically — has it been a tool for learning, or a tool for compliance?",
        ],
        focus:
          'What the board is trying to feel confident about, whether reporting drives behaviour',
      },
    },
  },
];

// ─── System prompts for conversation turns ──────────────────────

function buildConversationPrompt(
  conv: ConversationConfig,
  branch: string,
  turnNumber: number
): string {
  const branchConfig = conv.branches[branch];
  if (!branchConfig) return '';

  return `You are Nera, a Socratic interviewer conducting a branching strategic conversation on behalf of Carla Taylor at Carlorbiz. This is a premium showcase demonstrating genuine conversational intelligence — not a survey.

## CONVERSATION: ${conv.title}
## BRANCH: ${branch} — ${branchConfig.label}
## FOCUS: ${branchConfig.focus}
## TURN: ${turnNumber} of 3-4

## YOUR APPROACH
- Listen deeply to what the visitor actually said — reference their specific words
- Follow the thread they've opened, don't redirect to your agenda
- Ask ONE question at a time. Probe the thread, not the topic
- Warm, direct, Australian English. Senior consultant tone — not coaching, not therapy
- 1-2 sentences of acknowledgement + 1 question. Nothing more
- Do NOT introduce yourself or explain what you're doing
- Do NOT sell or pitch services during the conversation
- Do NOT repeat or rephrase a question the visitor has already answered

## SUGGESTED FOLLOW-UPS (use as inspiration, adapt to what they've said)
${branchConfig.followUps.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## WHEN TO WRAP UP
After 3-4 exchanges with the visitor (not counting the opener), you've likely gathered enough. On your final response, acknowledge what they've shared and say something like:
"Thanks for sharing that — there's real substance here. Give me a moment to pull together what I'm hearing."

Do NOT generate an insight card yourself. Just signal that the conversation is complete.`;
}

// ─── API helpers ────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const NERA_API_URL =
  import.meta.env.VITE_NERA_API_URL ||
  `${SUPABASE_URL}/functions/v1/nera-query`;

function getBranchClassifyUrl(): string {
  return `${SUPABASE_URL}/functions/v1/branch-classify`;
}

function getInsightExtractUrl(): string {
  return `${SUPABASE_URL}/functions/v1/insight-extract`;
}

async function classifyBranch(
  conversationId: string,
  userResponse: string,
  turnNumber: number,
  priorBranch?: string
): Promise<{ branch: string; confidence: number; signal: string }> {
  try {
    const res = await fetch(getBranchClassifyUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ conversationId, userResponse, turnNumber, priorBranch }),
    });
    const data = await res.json();
    return { branch: data.branch || 'A', confidence: data.confidence || 0.5, signal: data.signal || '' };
  } catch {
    return { branch: priorBranch || 'A', confidence: 0.3, signal: 'classification-fallback' };
  }
}

async function extractInsights(
  conversationId: string,
  conversationHistory: ChatMessage[],
  branch: string,
  branchSignal: string
): Promise<InsightCard> {
  const res = await fetch(getInsightExtractUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ conversationId, conversationHistory, branch, branchSignal }),
  });

  if (!res.ok) throw new Error(`Insight extraction failed (${res.status})`);
  return await res.json();
}

async function sendConversationTurn(
  query: string,
  sessionId: string,
  systemPrompt: string,
  conversationHistory: ChatMessage[]
): Promise<string> {
  const res = await fetch(NERA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      query,
      session_id: sessionId,
      public: true,
      system_prompt_override: systemPrompt,
      conversation_history: conversationHistory.filter((m) => m.content),
    }),
  });

  if (!res.ok) throw new Error(`Nera query failed (${res.status})`);

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await res.json();
    return data.answer || '';
  }

  // SSE stream — accumulate
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (currentEvent === 'delta' && parsed.text) {
            accumulated += parsed.text;
          } else if (currentEvent === 'meta' && parsed.answer) {
            accumulated = parsed.answer;
          }
        } catch {
          // skip
        }
      }
    }
  }

  return accumulated;
}

// ─── Webhook for lead notification ──────────────────────────────

async function fireLeadWebhook(email: string, conversationId: string, branch: string) {
  const webhookUrl = import.meta.env.VITE_LAYER2_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        conversationId,
        branch,
        source: 'nera-layer2-showcase',
        tag: 'nera-demo-lead',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Non-blocking — don't fail the user experience
  }
}

// ─── Anonymised conversation logging ────────────────────────────

async function logConversationMetadata(
  sessionId: string,
  conversationId: string,
  branch: string,
  turnCount: number,
  startTime: number
) {
  try {
    // Log via nera-query's existing logging (send a metadata-only query)
    await fetch(
      `${SUPABASE_URL}/functions/v1/nera-query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          query: `[layer2-metadata] ${conversationId} / branch-${branch} / ${turnCount}-turns / ${Math.round((Date.now() - startTime) / 1000)}s`,
          session_id: sessionId,
          public: true,
        }),
      }
    );
  } catch {
    // Non-blocking
  }
}

// ─── Component ──────────────────────────────────────────────────

interface NeraLayer2ConversationProps {
  userEmail?: string;
}

export function NeraLayer2Conversation({ userEmail }: NeraLayer2ConversationProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [activeConversation, setActiveConversation] = useState<ConversationConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [branchSignal, setBranchSignal] = useState('');
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [insightCard, setInsightCard] = useState<InsightCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(
    `layer2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const [conversationStartTime, setConversationStartTime] = useState(0);

  const threadContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    const container = threadContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Focus input after streaming
  useEffect(() => {
    if (!isStreaming && phase === 'conversation') {
      inputRef.current?.focus();
    }
  }, [isStreaming, phase]);

  // ─── Start a conversation ───────────────────────────────────

  const startConversation = useCallback((conv: ConversationConfig) => {
    setActiveConversation(conv);
    setMessages([{ role: 'assistant', content: conv.neraOpener }]);
    setUserTurnCount(0);
    setCurrentBranch(null);
    setBranchSignal('');
    setInsightCard(null);
    setError(null);
    setConversationStartTime(Date.now());
    setPhase('conversation');
  }, []);

  // ─── Handle user message ────────────────────────────────────

  const submit = useCallback(
    async (query: string) => {
      if (!query.trim() || isStreaming || !activeConversation) return;

      const userMessage: ChatMessage = { role: 'user', content: query.trim() };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');
      setIsStreaming(true);
      setError(null);

      const newTurnCount = userTurnCount + 1;
      setUserTurnCount(newTurnCount);

      try {
        // Step 1: Classify the branch (parallel-safe — fire and await)
        const classification = await classifyBranch(
          activeConversation.id,
          query.trim(),
          newTurnCount,
          currentBranch || undefined
        );

        const effectiveBranch = classification.branch;
        setCurrentBranch(effectiveBranch);
        setBranchSignal(classification.signal);

        // Step 2: Check if conversation should end (3-4 user turns)
        if (newTurnCount >= 4) {
          // Final acknowledgement
          const wrapUpMessages = [
            ...updatedMessages,
            {
              role: 'assistant' as const,
              content:
                "Thanks for sharing that — there's real substance here. Give me a moment to pull together what I'm hearing.",
            },
          ];
          setMessages(wrapUpMessages);
          setIsStreaming(false);

          // Extract insights
          setPhase('extracting');

          const insights = await extractInsights(
            activeConversation.id,
            wrapUpMessages,
            effectiveBranch,
            classification.signal
          );

          setInsightCard(insights);
          setPhase('insight');

          // Fire lead webhook + log metadata (non-blocking)
          if (userEmail) {
            fireLeadWebhook(userEmail, activeConversation.id, effectiveBranch);
          }
          logConversationMetadata(sessionId, activeConversation.id, effectiveBranch, newTurnCount, conversationStartTime);

          return;
        }

        // Step 3: Generate Nera's next question using branch-aware prompt
        const systemPrompt = buildConversationPrompt(
          activeConversation,
          effectiveBranch,
          newTurnCount
        );

        // Add placeholder for streaming
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        const response = await sendConversationTurn(
          query.trim(),
          sessionId,
          systemPrompt,
          updatedMessages
        );

        // Update the placeholder with the full response
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: response };
          return next;
        });

        // Check if Nera signalled wrap-up (turn 3+)
        const isWrapUp =
          newTurnCount >= 3 &&
          (response.toLowerCase().includes('pull together') ||
            response.toLowerCase().includes('what i\'m hearing') ||
            response.toLowerCase().includes('give me a moment'));

        if (isWrapUp) {
          setIsStreaming(false);
          setPhase('extracting');

          const allMessages = [
            ...updatedMessages,
            { role: 'assistant' as const, content: response },
          ];

          const insights = await extractInsights(
            activeConversation.id,
            allMessages,
            effectiveBranch,
            classification.signal
          );

          setInsightCard(insights);
          setPhase('insight');

          if (userEmail) {
            fireLeadWebhook(userEmail, activeConversation.id, effectiveBranch);
          }
          logConversationMetadata(sessionId, activeConversation.id, effectiveBranch, newTurnCount, conversationStartTime);

          return;
        }

        setIsStreaming(false);
      } catch (err) {
        console.error('Layer 2 conversation error:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, activeConversation, userTurnCount, currentBranch, sessionId, userEmail]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  // ─── Back to selection ──────────────────────────────────────

  const backToSelect = () => {
    setPhase('select');
    setActiveConversation(null);
    setMessages([]);
    setUserTurnCount(0);
    setCurrentBranch(null);
    setBranchSignal('');
    setInsightCard(null);
    setError(null);
  };

  // ─── RENDER: Scenario selection ─────────────────────────────

  if (phase === 'select') {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2 mb-6">
          <h3 className="font-heading text-xl font-bold text-[#2D7E32]">
            Choose your scenario
          </h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Each conversation follows a different thread based on what you actually say. No two
            insight cards are the same.
          </p>
        </div>

        <div className="grid gap-3">
          {CONVERSATIONS.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => startConversation(conv)}
              className="group w-full text-left rounded-xl border-2 border-border bg-card p-5 hover:border-[#2D7E32] hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-base text-foreground group-hover:text-[#2D7E32] transition-colors">
                    {conv.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    {conv.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {conv.starter}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[#2D7E32] flex-shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── RENDER: Extracting insights (loading state) ────────────

  if (phase === 'extracting') {
    return (
      <div className="space-y-4">
        {/* Show conversation history */}
        <div className="max-h-[40vh] overflow-y-auto pr-1 space-y-3">
          {messages.map((msg, idx) => (
            <MessageBubble key={idx} msg={msg} />
          ))}
        </div>

        {/* Extracting indicator */}
        <div className="rounded-xl border-2 border-[#D5B13A]/30 bg-gradient-to-br from-[#D5B13A]/5 to-transparent p-6 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#D5B13A]" />
          <p className="font-heading font-bold text-base text-foreground">
            Compiling insights from our conversation...
          </p>
          <p className="text-xs text-muted-foreground">
            This takes a few seconds — Nera is analysing the themes, tensions, and signals in what
            you shared.
          </p>
        </div>
      </div>
    );
  }

  // ─── RENDER: Insight card ───────────────────────────────────

  if (phase === 'insight' && insightCard) {
    return (
      <div className="space-y-6">
        {/* Collapsed conversation summary */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            View conversation ({messages.filter((m) => m.role === 'user').length} exchanges)
          </summary>
          <div className="mt-3 max-h-[30vh] overflow-y-auto pr-1 space-y-2">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} msg={msg} compact />
            ))}
          </div>
        </details>

        {/* The insight card */}
        <div className="rounded-xl border-2 border-[#D5B13A]/40 bg-gradient-to-br from-white to-[#D5B13A]/5 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2D7E32] to-[#1a5e1f] px-6 py-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[#D5B13A]" />
            <div>
              <p className="font-heading font-bold text-white text-base">
                Your Insight Card
              </p>
              <p className="text-white/70 text-xs">
                {activeConversation?.title} — Branch {currentBranch}
              </p>
            </div>
          </div>

          {/* Sections */}
          <div className="divide-y divide-[#D5B13A]/15">
            <InsightSection
              label="Core Tension"
              content={insightCard.coreTension}
              accent="text-red-700"
            />
            <InsightSection
              label="Organisational Signal"
              content={insightCard.organisationalSignal}
              accent="text-amber-700"
            />
            <InsightSection
              label="Key Insight"
              content={insightCard.keyInsight}
              accent="text-[#2D7E32]"
              highlighted
            />
            <InsightSection
              label="A Question to Sit With"
              content={insightCard.questionToSitWith}
              accent="text-blue-700"
              italic
            />
            <div className="px-6 py-4 bg-[#2D7E32]/5">
              <p className="text-xs font-heading font-bold text-[#2D7E32] uppercase tracking-wider mb-2">
                A Possible Next Step
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {insightCard.possibleNextStep}
              </p>
              {insightCard.serviceUrl && (
                <a
                  href={insightCard.serviceUrl}
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-[#2D7E32] hover:underline"
                >
                  Learn more about {insightCard.service}
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={backToSelect}
            className="flex-1 flex items-center justify-center gap-2 rounded-full border-2 border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:border-[#2D7E32] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Try another scenario
          </button>
          <a
            href="/contact"
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-accent)] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <MessageSquare className="h-4 w-4" />
            Continue with Carla
          </a>
        </div>

        {/* Framing */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-md mx-auto">
          This is what Nera builds for every conversation — at scale, across hundreds of
          participants simultaneously. Each card is unique because every conversation is different.
        </p>
      </div>
    );
  }

  // ─── RENDER: Active conversation ────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={backToSelect}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Back to scenarios"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-sm text-[#2D7E32]">
            {activeConversation?.title}
          </p>
          {currentBranch && (
            <p className="text-xs text-muted-foreground">
              Thread: {activeConversation?.branches[currentBranch]?.label}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={threadContainerRef}
        className="space-y-3 max-h-[50vh] overflow-y-auto pr-1"
      >
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} msg={msg} />
        ))}

        {/* Thinking indicator */}
        {isStreaming &&
          messages[messages.length - 1]?.role === 'assistant' &&
          !messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Considering your response...</span>
              </div>
            </div>
          )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your response..."
          disabled={isStreaming}
          className="flex-1 border-2 border-border rounded-md px-4 py-2.5 text-sm focus:border-[var(--color-brand-accent)] outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="bg-[image:var(--gradient-accent)] text-white px-4 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          aria-label="Send"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      <p className="text-xs text-muted-foreground text-center">
        {userTurnCount < 3
          ? `${3 - userTurnCount} more exchange${3 - userTurnCount === 1 ? '' : 's'} before your insight card`
          : 'Wrapping up...'}
      </p>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function MessageBubble({ msg, compact }: { msg: ChatMessage; compact?: boolean }) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          compact ? 'text-xs' : 'text-sm'
        } ${
          msg.role === 'user'
            ? 'bg-[var(--color-brand-primary)] text-white rounded-br-sm'
            : 'bg-muted border border-border rounded-bl-sm'
        }`}
      >
        {msg.role === 'user' ? (
          <p className="leading-relaxed">{msg.content}</p>
        ) : msg.content ? (
          <div className={`prose ${compact ? 'prose-xs' : 'prose-sm'} max-w-none`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InsightSection({
  label,
  content,
  accent,
  highlighted,
  italic,
}: {
  label: string;
  content: string;
  accent: string;
  highlighted?: boolean;
  italic?: boolean;
}) {
  return (
    <div className={`px-6 py-4 ${highlighted ? 'bg-[#2D7E32]/5 border-l-4 border-[#2D7E32]' : ''}`}>
      <p className={`text-xs font-heading font-bold ${accent} uppercase tracking-wider mb-1.5`}>
        {label}
      </p>
      <p className={`text-sm text-foreground leading-relaxed ${italic ? 'italic' : ''}`}>
        {content}
      </p>
    </div>
  );
}
