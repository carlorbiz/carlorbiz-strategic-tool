// Setup Wizard Step 4 — Questionnaire (CC-94, increment 3).
//
// Loads the getting-started questions from the engagement's 'onboarding'
// st_engagement_stages row (question_set), falling back to the local
// DEFAULT_QUESTIONS copy if the stage is missing. Every question is optional.
//
// Drafts autosave to st_engagement_setup.questionnaire_answers (debounced on
// type, flushed on blur) so nothing is lost if the tab closes.
//
// "Save and continue":
//   (a) persists the final answers ({ answers: {id: {question, answer}},
//       answered_at }) via updateSetupFields,
//   (b) records ONE st_stakeholder_inputs row against the onboarding stage
//       carrying the combined Q&A (updated in place on re-runs),
//   (c) calls st-seed-questionnaire to turn the answers into
//       knowledge_chunks (verbatim, no LLM; idempotent server-side),
//   then advances. If every answer is empty, (b)/(c) are skipped and the
//   wizard just moves on — Nera works with whatever she's given.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_QUESTIONS,
  seedQuestionnaire,
  updateSetupFields,
  type QuestionnaireAnswer,
  type QuestionnaireAnswersPayload,
} from '@/lib/setupApi';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface SetupQuestionnaireStepProps {
  engagementId: string;
  onBack: () => void;
  onNext: () => void;
}

interface Question {
  id: string;
  question: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 1200;

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id.length > 0 && typeof v.question === 'string';
}

// Answers map for persistence: every question with a non-empty answer, with
// the question text carried alongside so downstream consumers stay honest.
function buildAnswers(
  questions: Question[],
  drafts: Record<string, string>,
  trim: boolean,
): Record<string, QuestionnaireAnswer> {
  const answers: Record<string, QuestionnaireAnswer> = {};
  for (const q of questions) {
    const raw = drafts[q.id] ?? '';
    if (!raw.trim()) continue;
    answers[q.id] = { question: q.question, answer: trim ? raw.trim() : raw };
  }
  return answers;
}

export function SetupQuestionnaireStep({
  engagementId,
  onBack,
  onNext,
}: SetupQuestionnaireStepProps) {
  const { profile } = useAuth();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [submitting, setSubmitting] = useState(false);

  // Refs so the debounced save always sees the latest state without
  // re-arming the timer on every keystroke's render.
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const questionsRef = useRef<Question[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the question set from the onboarding stage + any saved answers.
  useEffect(() => {
    if (!supabase) {
      setQuestions(DEFAULT_QUESTIONS);
      questionsRef.current = DEFAULT_QUESTIONS;
      return;
    }
    let cancelled = false;
    (async () => {
      const [stageRes, setupRes] = await Promise.all([
        supabase
          .from('st_engagement_stages')
          .select('id, question_set')
          .eq('engagement_id', engagementId)
          .eq('stage_type', 'onboarding')
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('st_engagement_setup')
          .select('questionnaire_answers')
          .eq('engagement_id', engagementId)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const fromStage = Array.isArray(stageRes.data?.question_set)
        ? (stageRes.data.question_set as unknown[]).filter(isQuestion)
        : [];
      const qs = fromStage.length > 0 ? fromStage : DEFAULT_QUESTIONS;
      questionsRef.current = qs;
      setQuestions(qs);
      setStageId(stageRes.data?.id ?? null);

      const saved = setupRes.data?.questionnaire_answers as QuestionnaireAnswersPayload | null;
      if (saved?.answers && typeof saved.answers === 'object') {
        const initial: Record<string, string> = {};
        for (const [id, entry] of Object.entries(saved.answers)) {
          if (entry && typeof entry.answer === 'string') initial[id] = entry.answer;
        }
        setDrafts(initial);
      }
    })().catch(() => {
      if (!cancelled) {
        // Questions are the one thing this step can't do without — fall back.
        questionsRef.current = DEFAULT_QUESTIONS;
        setQuestions(DEFAULT_QUESTIONS);
      }
    });
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [engagementId]);

  const persistDraft = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSaveState('saving');
    try {
      const payload: QuestionnaireAnswersPayload = {
        answers: buildAnswers(questionsRef.current, draftsRef.current, false),
        answered_at: null, // draft — finalised on "Save and continue"
      };
      await updateSetupFields(engagementId, { questionnaire_answers: payload });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const handleChange = (id: string, value: string) => {
    setDrafts(prev => ({ ...prev, [id]: value }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persistDraft(), AUTOSAVE_DELAY_MS);
  };

  const handleBlur = () => {
    // Flush a pending autosave immediately when the field loses focus.
    if (timerRef.current) void persistDraft();
  };

  const handleSaveContinue = async () => {
    if (!questions) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const answers = buildAnswers(questions, drafts, true);
    const entries = questions
      .map(q => answers[q.id] && { id: q.id, ...answers[q.id] })
      .filter((e): e is { id: string; question: string; answer: string } => Boolean(e));

    // Nothing answered — that's fine. Skip the seeding and move on.
    if (entries.length === 0) {
      onNext();
      return;
    }

    setSubmitting(true);
    try {
      const answeredAt = new Date().toISOString();

      // (a) Final answers on the setup row.
      await updateSetupFields(engagementId, {
        questionnaire_answers: { answers, answered_at: answeredAt },
      });

      // (b) One stakeholder input against the onboarding stage carrying the
      // combined Q&A. Updated in place on re-runs (never duplicated). Failing
      // soft here: the answers are already saved and the chunks still seed.
      if (stageId && supabase) {
        try {
          const row = {
            conversation_history: entries.flatMap(e => [
              { role: 'assistant', content: e.question },
              { role: 'user', content: e.answer },
            ]),
            extracted_insights: {
              source: 'setup_questionnaire',
              answers,
              answered_at: answeredAt,
            },
            is_complete: true,
          };
          const { data: existing, error: findErr } = await supabase
            .from('st_stakeholder_inputs')
            .select('id')
            .eq('stage_id', stageId)
            .eq('extracted_insights->>source', 'setup_questionnaire')
            .limit(1)
            .maybeSingle();
          if (findErr) throw findErr;
          if (existing) {
            const { error } = await supabase
              .from('st_stakeholder_inputs')
              .update(row)
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('st_stakeholder_inputs').insert({
              stage_id: stageId,
              engagement_id: engagementId,
              user_id: profile?.id ?? null,
              ...row,
            });
            if (error) throw error;
          }
        } catch {
          toast.error("Answers saved, but they couldn't be recorded against the onboarding stage.");
        }
      }

      // (c) Seed the answers into Nera's knowledge (idempotent server-side).
      const { seeded } = await seedQuestionnaire(engagementId);
      toast.success(
        `${entries.length} answer${entries.length === 1 ? '' : 's'} saved — Nera now knows ${seeded === entries.length ? 'all of it' : 'what you shared'}.`,
      );
      onNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save the questionnaire.');
    } finally {
      setSubmitting(false);
    }
  };

  if (questions === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>Questionnaire</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const answeredCount = Object.keys(buildAnswers(questions, drafts, true)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>Questionnaire</CardTitle>
        <CardDescription>
          A few getting-started questions to fill the gaps the documents don't cover. Answer what
          you can, skip what you can't — Nera works with whatever you give her.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded border p-4 space-y-2">
            <Label htmlFor={`setup-q-${q.id}`} className="leading-snug">
              {i + 1}. {q.question}
            </Label>
            <Textarea
              id={`setup-q-${q.id}`}
              value={drafts[q.id] ?? ''}
              onChange={e => handleChange(q.id, e.target.value)}
              onBlur={handleBlur}
              rows={3}
              placeholder="In your own words — a sentence or two is plenty."
              disabled={submitting}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {saveState === 'saving' && 'Saving draft...'}
          {saveState === 'saved' && 'Draft saved — safe to close the tab and come back.'}
          {saveState === 'error' &&
            "Couldn't save the draft just now — it will try again as you keep typing."}
        </p>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button onClick={handleSaveContinue} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
            </>
          ) : answeredCount === 0 ? (
            'Skip for now'
          ) : (
            'Save and continue'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
