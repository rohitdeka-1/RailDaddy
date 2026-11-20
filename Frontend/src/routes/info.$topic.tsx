import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileText, Info, LifeBuoy, Lock, Mail, RotateCcw, ShieldCheck } from "lucide-react";

type Topic = {
  title: string;
  kicker: string;
  intro: string;
  points: Array<{ heading: string; body: string }>;
  closing: string;
};

const topics: Record<string, Topic> = {
  about: {
    title: "About Rail Daddy",
    kicker: "Who we are",
    intro: "Rail Daddy helps you find trains across India and compare schedules for your trip.",
    points: [
      { heading: "What Rail Daddy does", body: "Searches direct trains between two stations on your travel date and shows departure times, arrival times and journey durations." },
      { heading: "What Rail Daddy is not", body: "We are not Indian Railways. Tickets are issued, confirmed and cancelled through authorized Indian Railways channels." },
      { heading: "Seat availability and fares", body: "Check the authorized booking channel for fares, seat availability and tickets." },
    ],
    closing: "Ready to look at trains? Head back to the search.",
  },
  help: {
    title: "Help",
    kicker: "Before you search",
    intro: "Quick answers to the things people ask us most often.",
    points: [
      { heading: "How a search works", body: "Choose a station from the From and To suggestions or enter its code, pick a travel date, then press Find my train." },
      { heading: "Dates", body: "Pick the date you want to depart from your boarding station. Times are shown in IST." },
    ],
    closing: "Still stuck? The Contact page is the quickest way to reach us.",
  },
  cancellation: {
    title: "Cancellation and refund policy",
    kicker: "Money back",
    intro: "Refunds follow the rules of the channel that issued your ticket. Rail Daddy does not hold your fare.",
    points: [
      { heading: "Who cancels what", body: "Cancellations and refunds are processed by the authorized Indian Railways channel that issued the ticket. The same channel applies its own cutting dates and charges." },
      { heading: "Typical windows", body: "Railways usually refunds more the further ahead you cancel, and less close to departure. The exact cut-off depends on the train, the class and whether the ticket was Tatkal." },
      { heading: "Tatkal tickets", body: "Tatkal tickets have narrower refund rules than General tickets, and usually refund less." },
      { heading: "What we show you", body: "Fares and refund figures on this preview page are samples. Real amounts come from the issuing channel at the moment you cancel." },
    ],
    closing: "Have a ticket number? Contact us and we'll point you to the right window.",
  },
  privacy: {
    title: "Privacy",
    kicker: "Your data",
    intro: "Short version: we keep as little as possible, and nothing leaves your device in this build.",
    points: [
      { heading: "What is stored on your device", body: "Your recent stations and your last search are saved in this browser only, so the page can offer them again next visit. Clearing site data removes them." },
      { heading: "Accounts", body: "When you create an account, we store your sign-in email, a password hash, and your profile details. The booking preview does not store booking history or payment data on the server." },
      { heading: "When bookings go live", body: "Personal details will be shared with the authorized channel that issues your ticket, and used only to complete that booking." },
    ],
    closing: "Questions about a specific detail? Ask us from the Contact page.",
  },
  contact: {
    title: "Contact",
    kicker: "Talk to us",
    intro: "Tell us where you are stuck — a route, a class, a refund — and we'll help you find the train.",
    points: [
      { heading: "Contact channels", body: "An email address and phone number are not published in this preview yet. They will appear here once the real channels are set up." },
      { heading: "Response times", body: "Not committed to in this preview. We would rather state a real number than promise one we cannot keep." },
    ],
    closing: "Meanwhile, the search is the fastest way to get moving.",
  },
};

const topicIcons = { about: Info, help: LifeBuoy, cancellation: RotateCcw, privacy: Lock, contact: Mail } as const;

export const Route = createFileRoute("/info/$topic")({
  loader: ({ params }) => {
    const topic = topics[params.topic];
    if (!topic) throw notFound();
    return { topic: params.topic, ...topic };
  },
  head: ({ params }) => {
    const t = topics[params.topic];
    const title = t ? `Rail Daddy — ${t.title}` : "Rail Daddy";
    const description = t ? t.intro : "About, help, refunds and privacy for Rail Daddy.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: InfoPage,
});

function InfoPage() {
  const page = Route.useLoaderData();
  const Icon = topicIcons[page.topic as keyof typeof topicIcons] ?? FileText;

  return (
    <div className="railway-app info-page">
      <header className="info-bar">
        <Link to="/" className="info-brand">RAIL DADDY<span className="footer-stop">.</span></Link>
        <Link to="/" className="info-back"><ArrowLeft size={15} aria-hidden="true" /> Back to search</Link>
      </header>
      <main className="info-main">
        <article className="info-card">
          <div className="info-head">
            <span className="info-icon"><Icon size={20} aria-hidden="true" /></span>
            <div>
              <p className="info-kicker">{page.kicker}</p>
              <h1 className="info-title">{page.title}</h1>
            </div>
          </div>
          <p className="info-intro">{page.intro}</p>
          <div className="info-points">
            {page.points.map((point) => (
              <section className="info-point" key={point.heading}>
                <h2>{point.heading}</h2>
                <p>{point.body}</p>
              </section>
            ))}
          </div>
          <p className="info-closing">{page.closing}</p>
          <Link to="/" className="info-cta">Find my train<ArrowLeft size={16} aria-hidden="true" style={{ transform: "rotate(180deg)" }} /></Link>
          <div className="info-trust">
            <span className="trust-badge"><ShieldCheck size={15} aria-hidden="true" /> Secure payment</span>
            <span className="trust-badge"><RotateCcw size={15} aria-hidden="true" /> Refund policy</span>
          </div>
        </article>
      </main>
    </div>
  );
}
