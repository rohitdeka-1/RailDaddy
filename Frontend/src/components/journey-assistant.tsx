import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ArrowUp, Plus, Sparkles, TrainFront } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { postJourney, type JourneyTrip } from "@/lib/railway";
import { tripDateLabel } from "@/lib/trip";

const quickAnswers = [
  { question: "How do I find a connection?", answer: "Search your route and date, then open Plan a connecting trip. Choose your departure or arrival time, how many changes you can make, and any stations where you want to avoid changing." },
  { question: "Can I check seats and fares?", answer: "Use the authorized booking channel to check the fare and seat availability for each train, boarding station, destination, and date. This planner currently has timetable access." },
  { question: "Do I need separate tickets?", answer: "Connecting trains may require a separate ticket for each leg. Check each leg before you buy and leave enough time to change trains, especially if the next train leaves from a different station." },
];

type Turn = { id: number; question: string; trip: JourneyTrip | undefined; answer?: string; error?: string };

export function JourneyAssistant({ open, onOpenChange, trip, initialQuestion = "" }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: JourneyTrip | undefined;
  initialQuestion?: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [docked, setDocked] = useState(false);
  const nextTurn = useRef(0);
  const questionId = useId();
  const heading = useRef<HTMLElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => setQuestion(initialQuestion), [initialQuestion]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const sync = () => setDocked(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const ask = useMutation({
    mutationFn: (turn: Turn) => {
      const history = turns.flatMap((earlier) => earlier.id < turn.id && earlier.answer
        ? [{ question: earlier.question, answer: earlier.answer.slice(0, 1000) }]
        : []).slice(-4);
      return postJourney<{ answer: string }>("ask", { question: turn.question, trip: turn.trip, history });
    },
    onSuccess: ({ answer }, turn) => setTurns((current) => current.map((item) =>
      item.id === turn.id ? { id: item.id, question: item.question, trip: item.trip, answer } : item)),
    onError: (error, turn) => setTurns((current) => current.map((item) =>
      item.id === turn.id ? { ...item, error: error.message } : item)),
  });

  useEffect(() => {
    if (open && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [open, turns, ask.isPending]);

  function send(text: string) {
    const value = text.trim();
    if (!value || ask.isPending) return;
    const turn = { id: nextTurn.current++, question: value, trip };
    const preset = quickAnswers.find((item) => item.question.toLowerCase() === value.toLowerCase());
    setQuestion("");
    setTurns((current) => [...current, preset ? { ...turn, answer: preset.answer } : turn]);
    if (!preset) ask.mutate(turn);
    composer.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(question);
  }

  function newChat() {
    setTurns([]);
    setQuestion("");
    ask.reset();
    composer.current?.focus();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={!docked}>
      <DialogContent className="journey-assistant" data-docked={docked}
        onInteractOutside={(event) => { if (docked) event.preventDefault(); }}
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          event.preventDefault();
          (docked ? composer.current : heading.current)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}>
        <header className="assistant-header" ref={heading} tabIndex={-1}>
          <DialogTitle><Sparkles size={16} aria-hidden="true" /> Ask Daddy AI</DialogTitle>
          <DialogDescription className="sr-only">A chat sidebar for rail travel questions.</DialogDescription>
          <Button variant="ghost" size="sm" type="button" onClick={newChat} disabled={ask.isPending || (!turns.length && !question)}
            aria-label="New chat" title="New chat"><Plus size={16} aria-hidden="true" /><span>New chat</span></Button>
        </header>

        <div className="assistant-transcript" role="log" aria-label="Conversation" ref={transcript}>
          {turns.length === 0 ? (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon"><Sparkles size={23} aria-hidden="true" /></div>
              <h3>Where are you headed?</h3>
              <p>Ask about connections, tickets, or planning your trip.</p>
              <div className="assistant-suggestions">
                {quickAnswers.map(({ question: prompt }) => (
                  <Button key={prompt} variant="ghost" type="button" onClick={() => send(prompt)}>
                    {prompt}<ArrowRight size={14} aria-hidden="true" />
                  </Button>
                ))}
              </div>
            </div>
          ) : turns.map((turn) => (
            <div className="assistant-turn" key={turn.id}>
              <div className="assistant-user-message">
                <span className="sr-only">You</span>
                <p>{turn.question}</p>
              </div>
              <div className="assistant-reply">
                <span className="assistant-reply-label"><Sparkles size={14} aria-hidden="true" /> Rail Daddy</span>
                {ask.isPending && ask.variables?.id === turn.id ? <p role="status" className="flow-sub">Thinking…</p> :
                  turn.error ? <div className="assistant-error">
                    <p role="alert">{turn.error}</p>
                    {turn.id === turns.at(-1)?.id && <Button variant="outline" size="sm" type="button"
                      onClick={() => ask.mutate(turn)} disabled={ask.isPending}>Retry</Button>}
                  </div> : <p>{turn.answer}</p>}
              </div>
            </div>
          ))}
        </div>

        <footer className="assistant-footer">
          {trip && <div className="assistant-trip" aria-label="Current trip">
            <TrainFront size={14} aria-hidden="true" />
            <span>{trip.source} → {trip.destination} · {tripDateLabel(trip.date)}</span>
          </div>}
          <form className="assistant-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor={questionId}>Rail travel question</label>
            <textarea id={questionId} ref={composer} rows={2} maxLength={600} placeholder="Ask a rail travel question…"
              value={question} onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                send(question);
              }} />
            <div className="assistant-composer-actions">
              <span className="assistant-shortcut">Enter to send · Shift+Enter for a new line</span>
              <Button variant="journey" size="icon" type="submit" aria-label="Send message" title="Send message"
                disabled={!question.trim() || ask.isPending}><ArrowUp size={17} aria-hidden="true" /></Button>
            </div>
          </form>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
